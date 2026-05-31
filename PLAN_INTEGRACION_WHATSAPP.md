# Plan de integración de WhatsApp en CLERIVO

Este documento es **solo planificación técnica**. Ninguna parte está
implementada todavía. Su objetivo es servir como mapa de la próxima fase
de desarrollo, en la que WhatsApp será el primer canal real por donde los
clientes de los negocios contacten al Agente IA.

---

## 1. Contexto del negocio

CLERIVO es una plataforma SaaS donde un **dueño de negocio** configura un
**Agente IA** que responde consultas de sus clientes finales. Ese agente
conoce:

- El nombre, rubro y descripción del negocio
- Un objetivo principal (vender, dar seguimiento, atender consultas, …)
- Uno o varios **tonos** preferidos
- **Instrucciones libres** que el dueño escribió en lenguaje natural
- Reglas de respuesta (qué puede afirmar, qué evitar, cuándo escalar)
- Una lista de productos como contexto opcional

WhatsApp será **el canal principal** desde donde llegan los mensajes de
los clientes finales. Por eso es prioridad #1 después del MVP del wizard.

---

## 2. Arquitectura propuesta

### 2.1 Proveedor de API

**Elegimos WhatsApp Business Platform (Cloud API de Meta)** como destino
final. Para acelerar el time-to-market y reducir la fricción de onboarding
empezamos integrando vía **un BSP (Business Solution Provider)**. Las dos
opciones que evaluamos:

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Meta Cloud API directa** | Costo más bajo por mensaje. Sin intermediarios. Acceso a features nuevos primero. | Onboarding más burocrático (verificación Meta Business, número provisorio, plantillas). Webhook propio obligatorio. |
| **Twilio** | Onboarding rápido. SDK estable en muchos lenguajes. Buena documentación. | Costo por mensaje más alto. Latencia adicional. |
| **360dialog** | Foco 100 % en WhatsApp. Acceso directo a Cloud API con verificación más rápida. Precios competitivos. | Soporte sólo en EU/LatAm en algunos planes. |

**Decisión**: arrancamos con **360dialog** por la combinación de rapidez
de verificación y precio. Mantenemos el código abstraído detrás de una
interfaz `WhatsAppProvider` para poder cambiar a Meta directo más
adelante sin tocar la lógica de negocio.

### 2.2 Flujo de un mensaje entrante

```
[Cliente del negocio]
    │  envía mensaje al número de WhatsApp del negocio
    ▼
[WhatsApp Business Cloud / 360dialog]
    │  POST → /api/webhooks/whatsapp
    ▼
[CLERIVO Webhook Endpoint]
    │  1. Verifica firma del webhook
    │  2. Resuelve el negocio por phone_number_id
    │  3. Persiste el mensaje entrante (tabla `messages`)
    │  4. Actualiza/crea la `conversation`
    │  5. Encola job → cola async (BullMQ / Cloudflare Queues)
    ▼
[Worker: AgentResponder]
    │  1. Carga `agent` + `business` + `last_N_messages`
    │  2. Llama al servicio OpenAI (ver PLAN_INTEGRACION_OPENAI.md)
    │  3. Aplica reglas locales (filtros pre/post respuesta)
    │  4. Persiste la respuesta como mensaje saliente
    │  5. Envía la respuesta a través del provider
    ▼
[Cliente del negocio recibe la respuesta]
```

El worker es **asíncrono** desde el webhook para responder con `200 OK`
en menos de 5 s (límite de WhatsApp). Si la generación toma más,
el cliente recibe la respuesta cuando esté lista, sin bloquear el
webhook.

### 2.3 Datos persistidos por conversación

```sql
-- Esquema mínimo
business_whatsapp_account (
  business_id, phone_number_id, display_phone_number,
  provider, access_token_ref, webhook_verify_token,
  status (pending | verified | suspended),
  created_at, verified_at
)

whatsapp_conversations (
  id, business_id, customer_wa_id,
  customer_name, customer_phone,
  lead_status (nuevo | interesado | caliente | seguimiento | cliente | perdido),
  handler (bot | human),
  last_message_at, created_at
)

whatsapp_messages (
  id, conversation_id, direction (in | out),
  wa_message_id, content, content_type (text | image | template | …),
  delivered_at, read_at, created_at
)

whatsapp_template_messages (
  business_id, name, locale, body, status (approved | pending | rejected)
)
```

La tabla `whatsapp_conversations` alimenta directamente la lista de Chats
del panel actual — el mapeo `conversation → Conversation` (tipo del
frontend) es directo.

### 2.4 Vinculación canal → negocio

Cada negocio en CLERIVO puede vincular **un único número de WhatsApp**
en la primera fase. El vínculo se hace por `phone_number_id` que da el
provider al verificar el número. Múltiples números por negocio queda en
backlog para una fase posterior.

---

## 3. Flujo de configuración desde el panel

Esta es la UX que el dueño del negocio va a ver dentro de
`/app/integrations`:

### 3.1 Pasos

1. **Estado inicial**: la card de WhatsApp muestra "No conectado" y un
   botón "Conectar WhatsApp".
2. **Modal de conexión** (paso 1/3): explica los requisitos —
   - Tener una cuenta Meta Business verificada O un número validable.
   - Aceptar las políticas comerciales de WhatsApp.
   - Botón "Continuar".
3. **Ingreso de datos** (paso 2/3): el usuario ingresa
   - Número de teléfono a vincular (con el código de país)
   - Display name del negocio (lo que ve el cliente)
   - Acepta el flujo OAuth/Embedded Signup de Meta o del BSP elegido
4. **Verificación del número** (paso 3/3):
   - Si es Cloud API directa: se envía SMS / llamada con código de 6
     dígitos al número que el usuario ingresa.
   - Si es 360dialog: redirección al embedded signup, vuelve con un
     `phone_number_id` ya verificado.
5. **Activación**: una vez verificado, aparece un toggle "Activar agente
   en este canal". Cuando se activa:
   - Se llama al endpoint `/api/integrations/whatsapp/activate`
   - El sistema queda escuchando webhooks para ese número
   - El agente IA empieza a responder

### 3.2 Estados visuales en la card de Integraciones

| Estado | Pill visible | Acción primaria |
|---|---|---|
| `not_connected` | "No conectado" gris | "Conectar WhatsApp" |
| `pending_verification` | "Verificando" amarillo | "Reanudar configuración" |
| `connected_inactive` | "Conectado · agente apagado" violeta | Toggle "Activar agente" |
| `connected_active` | "Activo" verde | "Administrar" |
| `error` | "Error de conexión" rojo | "Reintentar" |
| `suspended` | "Suspendido por Meta" gris | "Ver detalle" |

---

## 4. Contexto que el agente usará por cada conversación

Cuando llega un mensaje, antes de generar la respuesta el sistema arma
el **contexto del agente** combinando:

- **Identidad**: `agent.agentName`, `agent.businessName`, `agent.businessType`
- **Misión**: `agent.mainGoal`
- **Personalidad**: `agent.tones` (todos los tonos activos)
- **Instrucciones libres**: `agent.instructions` (lo que el dueño escribió)
- **Reglas**: `agent.allowedTopics`, `agent.forbiddenClaims`,
  `agent.escalationRules`, `agent.hotLeadRules`
- **Productos**: catálogo activo si existe — un resumen máximo de
  30 productos con nombre, precio y descripción
- **Historial**: últimos 8-12 mensajes de la conversación actual
- **Metadata del cliente**: nombre detectado, lead status, idioma
  detectado

Cómo se traduce a un prompt de OpenAI ver
[`PLAN_INTEGRACION_OPENAI.md`](./PLAN_INTEGRACION_OPENAI.md).

---

## 5. Acciones del agente en WhatsApp

El agente, además de responder en lenguaje natural, debe:

| Acción | Disparador | Implementación |
|---|---|---|
| Responder con texto | Cualquier mensaje entrante | Llamada estándar a OpenAI |
| Detectar **intención de compra** | Frase del cliente coincide con un patrón (palabras clave + análisis de la respuesta de OpenAI) | Función JSON que el modelo emite |
| Clasificar lead (nuevo, interesado, caliente, seguimiento, cliente, perdido) | Cada respuesta del modelo incluye un campo `lead_status` opcional | El worker actualiza `conversation.lead_status` |
| Marcar oportunidad activa | Cuando el modelo indica `is_active_opportunity: true` | Flag visible en la card del cliente |
| Derivar a humano | El modelo detecta que la consulta excede sus reglas O coincide con `escalationRules` | Cambia `handler` a `"human"`, envía notificación al dueño, deja de auto-responder |
| Registrar en el panel | Siempre | El mensaje persiste en BD y aparece en `/app/chats` en tiempo real (vía SSE o polling cada 10s) |

Cuando el agente deriva a humano:

1. Se actualiza el handler a `human` en BD.
2. Se envía notificación push (campanita de la app) al dueño con un
   resumen automático.
3. Los mensajes siguientes esperan respuesta humana — el agente NO
   responde hasta que el dueño manualmente vuelva a poner `handler = bot`
   desde el panel.

---

## 6. Pendientes técnicos

### Backend
- [ ] Modelo de datos: `business_whatsapp_account`, `whatsapp_conversations`,
      `whatsapp_messages`, `whatsapp_template_messages`
- [ ] Endpoint `POST /api/webhooks/whatsapp` con verificación de firma
- [ ] Endpoint `GET /api/webhooks/whatsapp` para `hub.challenge` de Meta
- [ ] Worker queue (BullMQ / Cloudflare Queues) para procesamiento async
- [ ] Interfaz `WhatsAppProvider` con implementación `Dialog360Provider`
- [ ] Endpoint `POST /api/integrations/whatsapp/connect` (embedded signup)
- [ ] Endpoint `POST /api/integrations/whatsapp/verify`
- [ ] Endpoint `POST /api/integrations/whatsapp/activate`
- [ ] Endpoint `GET /api/integrations/whatsapp/status`
- [ ] Cron de validación diaria del estado del número (Meta puede
      suspender por uso indebido)
- [ ] Sistema de **templates aprobados** para conversaciones outbound
      (WhatsApp exige plantilla aprobada para iniciar conversaciones)

### Frontend
- [ ] Reemplazar el botón "Avisarme cuando esté" por el flujo real de
      conexión en `/app/integrations`
- [ ] Modal de 3 pasos con `react-hook-form` + `zod` para validar inputs
- [ ] Conectar el listado de Chats al backend real (reemplazar el seed
      placeholder)
- [ ] Real-time updates de mensajes entrantes (SSE o WebSocket)
- [ ] Toggle Activo/Humano por conversación que llama al backend
- [ ] Indicador "Bot pensando…" mientras el worker procesa
- [ ] Estados de error claros si el provider devuelve error de envío

### Integración con la API de WhatsApp
- [ ] Embedded signup con el SDK del BSP
- [ ] Manejo de webhooks con verificación de firma X-Hub-Signature
- [ ] Manejo de rate limits del provider (cola de salida con throttle)
- [ ] Reintento exponencial para mensajes que fallan
- [ ] Logging detallado para auditoría (cuenta + número + dirección + ts)
- [ ] Política de retención de mensajes (lo recomendado por Meta es 30
      días para el contenido completo, IDs y metadata persisten)

### Compliance
- [ ] Política de privacidad actualizada para reflejar el envío de
      mensajes a WhatsApp
- [ ] Opción para que el cliente final del negocio pida la baja
      ("STOP", "BAJA", "UNSUBSCRIBE")
- [ ] Manejo de errores 24h-window de WhatsApp (sólo se puede iniciar
      conversación con template aprobado fuera de la ventana)
