# Plan de integración con OpenAI en CLERIVO

Este documento es **solo planificación técnica**. Ninguna parte está
implementada todavía. Define cómo se va a integrar OpenAI como motor del
Agente IA en la próxima fase.

---

## 1. Rol de OpenAI en CLERIVO

OpenAI — específicamente la **Chat Completions API** con `gpt-4o`
(o `gpt-4o-mini` para conversaciones de bajo riesgo) — es el motor que
**genera** las respuestas del agente. CLERIVO se ocupa de:

1. **Construir el contexto** dinámico para cada conversación con los
   datos que el dueño configuró
2. **Persistir** el historial de mensajes
3. **Aplicar reglas de pre/post procesamiento** (filtros, sanitización,
   detección de intención)
4. **Cobrar y limitar** el uso según el plan del usuario

OpenAI **no almacena estado** entre llamadas — cada request va con todo el
contexto necesario. Esta separación de responsabilidades hace que sea
trivial cambiar de proveedor (Anthropic, Mistral, on-prem) sin tocar la
lógica de negocio.

---

## 2. Construcción del system prompt

Cada conversación arma un system prompt dinámico que combina **identidad
+ misión + personalidad + reglas + contexto**. Plantilla base:

```
Sos {agentName}, el asistente IA de {businessName} ({businessType}).

Tu misión principal: {mainGoal}.

Tonos a usar al responder: {tones.join(", ")}.

{IF agent.description}
Sobre el negocio:
{description}
{END}

{IF agent.instructions}
Instrucciones personalizadas del dueño del negocio:
{instructions}
{END}

Reglas de respuesta:
{IF allowedTopics.length > 0}
- Solo podés hablar sobre: {allowedTopics.join(", ")}
{END}
{IF forbiddenClaims.length > 0}
- Nunca afirmes ni inventes: {forbiddenClaims.join(", ")}
{END}
{IF escalationRules.length > 0}
- Derivá a una persona del equipo cuando: {escalationRules.join(", ")}
  En ese caso respondé brevemente que vas a derivar y emití
  `lead_status: "caliente"` y `should_escalate: true` en tu output JSON.
{END}

{IF products.length > 0}
Catálogo activo ({products.length} productos):
{products.slice(0, 30).map(p => `- ${p.name} — ${p.price} ${p.currency}`).join("\n")}
{IF products.length > 30}
…y otros productos. Si el cliente menciona algo que no ves acá, decí que
vas a consultar, NO inventes precios ni stock.
{END}
{END}

Idioma de respuesta: {language || "Español rioplatense"}
{IF useEmojis === false}
No uses emojis en tus respuestas.
{END}

Formato de respuesta:
- Respondé en lenguaje natural, máximo 4 oraciones por mensaje.
- Si detectás que el cliente quiere comprar, pedí los datos mínimos
  (producto, cantidad, forma de pago).
- Si no estás seguro de algo, decilo claramente — no inventes.
- Siempre devolvé un JSON con: { reply, lead_status, should_escalate,
  detected_intent, key_data_extracted }.
```

El prompt se **compila en memoria** en cada request — no se cachea
porque cualquier cambio en la configuración del agente debe reflejarse
inmediatamente.

---

## 3. Flujo de una conversación

```
Cliente envía mensaje → guardado en `messages` con direction='in'
   │
   ▼
Worker: cargar últimos N mensajes de la conversación (N=8 por defecto)
   │
   ▼
Compilar `system prompt` (sección 2) con datos actuales del agente
   │
   ▼
Armar el array `messages` para OpenAI:
   [
     { role: "system", content: systemPrompt },
     ...lastNMessages.map(m => ({
       role: m.direction === "in" ? "user" : "assistant",
       content: m.content
     })),
     { role: "user", content: nuevoMensaje }
   ]
   │
   ▼
Llamar a `openai.chat.completions.create(...)`
   │
   ▼
Parsear respuesta:
   - `reply` (string) → enviar al cliente por el canal correspondiente
   - `lead_status` → actualizar `conversation.lead_status` si cambió
   - `should_escalate` → cambiar handler a 'human' + notificar
   - `detected_intent` → loggear para analytics
   - `key_data_extracted` → guardar en `conversation.metadata`
   │
   ▼
Guardar el mensaje de salida en `messages` con direction='out'
   │
   ▼
Enviar `reply` al canal (WhatsApp, Instagram, etc.)
```

### Manejo del historial

- Por conversación se mantienen **todos** los mensajes en BD para
  auditoría y replay.
- Al armar el contexto se incluyen los **últimos 8 turnos** (un turno =
  par user/assistant).
- Si la suma de tokens del historial excede `MAX_CONTEXT_TOKENS = 3000`,
  se hace **truncamiento desde el medio** preservando el primer y último
  par para mantener coherencia.
- Cuando el modelo detecta un cambio claro de tema o un cierre
  ("listo", "gracias!", "te aviso"), se sube un flag `conversation_break`
  que reduce el contexto incluido en próximas llamadas a sólo los 2
  últimos mensajes — ahorra tokens en sesiones largas.

---

## 4. Parámetros de la API

| Parámetro | Valor | Justificación |
|---|---|---|
| `model` | `gpt-4o` (default) / `gpt-4o-mini` (plan free) | 4o tiene mejor seguimiento de instrucciones complejas y reglas; mini es más barato y suficiente para preguntas simples |
| `temperature` | `0.5` | Suficientemente creativo para sonar natural, suficientemente determinístico para respetar el tono y reglas. Por encima de 0.8 empieza a inventar. |
| `max_tokens` | `300` | Cubre ~4 oraciones de respuesta en español. Forzar respuestas concisas reduce costo y mejora UX en chat. |
| `presence_penalty` | `0.3` | Levemente positivo para evitar que repita las mismas frases (común en agentes de atención). |
| `frequency_penalty` | `0.2` | Igual razonamiento — evita repetir palabras. |
| `response_format` | `{ type: "json_object" }` | Forzar JSON estructurado garantiza que `lead_status`, `should_escalate` siempre vengan parseables. |
| `tools` | (futuro) | Function calling para acciones como `schedule_followup`, `mark_hot_lead`, `query_product_stock`. |
| `stream` | `false` (MVP) / `true` (futuro) | Streaming reduce TTFB perceptible. Se implementa en fase 2 — el MVP responde completo. |

Para el plan **Free** del usuario usamos `gpt-4o-mini` (10× más barato).
Para el plan **Pro+** usamos `gpt-4o` (mejor calidad). La elección del
modelo es un campo en `subscription_plan.openai_model` que el sistema
consulta al armar la request.

---

## 5. Gestión de costos y límites

### 5.1 Cálculo de costo por conversación

Aproximación en pesos por modelo (precios USD a noviembre 2024 ×
$1000 ARS):

| Modelo | Input $/1M tok | Output $/1M tok | Costo aprox por respuesta |
|---|---|---|---|
| `gpt-4o-mini` | $0.15 | $0.60 | ~$0.40 ARS por turno (input 1500 + output 300 tokens) |
| `gpt-4o` | $2.50 | $10.00 | ~$5.50 ARS por turno |

Una conversación promedio de 6 turnos → entre **$2.40 y $33 ARS**
de costo de OpenAI según el modelo.

### 5.2 Límites por plan

| Plan | Modelo | Mensajes mensuales incluidos | Acción al exceder |
|---|---|---|---|
| Free | `gpt-4o-mini` | 100 | El agente responde "Esta cuenta llegó al límite del plan" y deja `handler = human` |
| Starter | `gpt-4o-mini` | 1000 | Igual + email al dueño 80% del límite |
| Pro | `gpt-4o` | 5000 | Igual |
| Business | `gpt-4o` | 25000 + pay-as-you-go | Cobro por overage |

Se trackea en una tabla `usage_counters (business_id, month, count)`
incrementada por cada respuesta generada. Reset el día 1 de cada mes.

### 5.3 Cache de respuestas frecuentes

Para reducir costos en consultas repetidas (horarios, dirección, formas
de pago) se implementa un cache:

- Clave: hash de `(business_id, mensaje_normalizado)` → mensaje
  normalizado = lowercase + sin tildes + sin signos
- TTL: 24 h
- Solo se cachean respuestas con `detected_intent ∈ {info_horarios,
  info_pago, info_envio, saludo}`
- Cache HIT → no se llama a OpenAI, se devuelve la respuesta cacheada
  con un campo `cached: true`

Esperable: **~25 % de hit rate** en negocios con tráfico estable, lo
que reduce el costo total a tres cuartos.

---

## 6. Pendientes técnicos

### Backend
- [ ] Servicio `OpenAIClient` (wrapper) con retry exponencial y manejo
      de rate limit (429)
- [ ] Compilador de system prompt con tests unitarios cubriendo cada
      combinación de campos del agente
- [ ] Tabla `usage_counters` + middleware que valida y cuenta
- [ ] Tabla `response_cache` con TTL automático
- [ ] Endpoint admin `GET /api/admin/usage/:business_id` para soporte
- [ ] Configuración del modelo por plan: `subscription_plans.openai_model`
- [ ] Webhook handler que invoca `OpenAIClient.generateReply()` y
      persiste la respuesta
- [ ] Detector de loop / abuso: si un cliente envía >20 mensajes en
      1 minuto se pausan las respuestas automáticas y se notifica al
      dueño

### Seguridad
- [ ] API key de OpenAI en variables de entorno (NUNCA en código ni
      base de datos)
- [ ] Rotación de keys cada 90 días
- [ ] Logging de **requests** (sin contenido) para auditoría +
      logging de **respuestas truncadas** (primeros 200 chars)
- [ ] Sanitización del input del cliente antes de incluirlo en el
      prompt — strip de instrucciones tipo "ignora lo anterior" y
      similares (prompt injection básico)
- [ ] Pre-filtro de PII en outputs: si el modelo emite por error un
      número de tarjeta, DNI, etc., se enmascara antes de enviar

### Observabilidad
- [ ] Métricas: latencia por request, costo acumulado por business,
      tasa de error de OpenAI, % de respuestas cacheadas
- [ ] Alertas: latencia >5s, error rate >2 %, cost spike >150 % del
      día anterior
- [ ] Dashboard interno mostrando uso global y por business

### Frontend
- [ ] Pantalla de **uso** dentro de `/app/billing` con la cantidad de
      respuestas del mes en curso, modelo activo y costo estimado
- [ ] Banner "Estás llegando a tu límite mensual" al 80 % del cupo
- [ ] Indicador "Esta respuesta fue cacheada" (sutil, solo para debug
      en planes Business)

### Fallbacks
- [ ] Si OpenAI devuelve 5xx tres veces seguidas: cambiar `handler` a
      `"human"` automáticamente, enviar push al dueño con el último
      mensaje del cliente
- [ ] Si timeout >15 s: respuesta automática "Estoy procesando tu
      consulta, te respondo en breve" + cola para retry
- [ ] Política de **fail-soft**: nunca dejar al cliente sin respuesta,
      siempre derivar a humano antes que dejar el chat en silencio
