# whatsapp-twilio-lead-router

Servidor Node.js drop-in para equipos de real-estate que:

1. Recibe **SMS** entrantes en un número de Twilio (típicamente de Zillow,
   anuncios de Facebook, o webhooks de landing pages).
2. Clasifica la intención del lead — **buyer / seller / investor / nurture /
   spam** — con un motor de reglas barato primero, y solo cae en LLM si el
   motor de reglas duda.
3. Dispara un **auto-reply por WhatsApp** (via sender de Twilio WhatsApp)
   con un template por intención.
4. Guarda el lead + la conversación en SQLite con un log de eventos
   append-only.
5. Rutea los leads de alta intención a un webhook (`LEAD_NOTIFY_WEBHOOK`)
   — Slack, CRM, lo que sea — con todo el contexto.

Pensado para brokerages chicos/medianos que quieren "reaccionar en 60
segundos o pierdo el lead" sin pagar un CRM completo para eso.

> La data de demo es sintética (`Acme Realty`, `+15551234567`). Ponés
> credenciales reales de Twilio en `.env` para correrlo contra un número real.

## Por qué existe

En real-estate, la mayor parte de la conversión de un lead pasa en los
primeros minutos después del contacto inicial. Los brokerages pierden esa
ventana todo el tiempo porque:

- El agente ve el SMS a las 9:47 PM y lo atiende a la mañana siguiente.
- Los autoresponders genéricos ("gracias, te contactamos") queman el lead.
- Cuando el agente contesta, no hay tag de intención, así que trata a un
  buyer caliente igual que a un curioso.

Lo que hace este router:

- Responde en WhatsApp en <2s, con un wording adaptado a la intención detectada.
- Pinguea a Slack/CRM solo para leads calientes, con intent pre-clasificado
  + el texto completo del inbound.
- Manda los leads nurture a un drip programado (día 1 / 3 / 7) sin
  intervención humana.

## Quickstart

```bash
git clone https://github.com/sarteta/whatsapp-twilio-lead-router.git
cd whatsapp-twilio-lead-router
npm install
cp .env.example .env            # poner creds de Twilio o dejar vacío para modo demo
npm test                        # corre la suite
npm run dev                     # escucha en localhost:3000
```

Apuntás el webhook de SMS del número de Twilio a:

```
https://tu-host.example/webhooks/sms
```

### Modo demo (sin cuenta Twilio)

```bash
npm run demo
```

Levanta el server y tira 8 SMS sintéticos (buyer / seller / investor /
spam / stop / etc.), imprime la clasificación y el auto-reply. Usa el
driver mock de Twilio — cero llamadas de red.

## Features

- **Clasificador rule-first.** La mayoría de los inbounds matchean una
  regla por keyword y nunca tocan el LLM — el costo de LLM queda cerca
  de cero.
- **Fallback LLM acotado.** Solo inputs ambiguos disparan LLM. La
  respuesta se parsea estricto a una de las labels permitidas; cualquier
  desviación cae a `nurture` (default seguro).
- **Validación de firma de Twilio** en todos los webhooks — requests
  spoofeados se descartan.
- **Idempotencia por `MessageSid`.** Twilio reintenta en timeouts; el
  handler dedupea para que el mismo inbound no dispare dos auto-replies.
- **Log append-only en SQLite.** Cada inbound, clasificación, outbound y
  webhook queda como una fila. Sirve para auditar y testear templates.
- **Quiet hours.** Fuera de `QUIET_HOURS_START/END` (en TZ del dueño) el
  auto-reply es honesto — "recibimos tu mensaje, te contestamos a las 9am"
  — en vez de hacerse el despierto.
- **STOP / HELP** (requerido por Twilio).

## Licencia

MIT — ver [LICENSE](./LICENSE).

Armado por [Santiago Arteta](https://github.com/sarteta) a partir de
trabajo de automatización para real-estate. Forks e issues bienvenidos.
