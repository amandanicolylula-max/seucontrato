// Reproduz a chamada exata da analyze-corplaw-background pra ver o erro
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const env = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(l => l.includes('=')).reduce((a, l) => { const [k, ...v] = l.split('='); a[k.trim()] = v.join('=').trim(); return a }, {})
const apiKey = env.ANTHROPIC_API_KEY

if (!apiKey) { console.log('SEM API KEY'); process.exit(1) }

const client = new Anthropic({ apiKey })

const SIMPLE_SCHEMA = {
  type: 'object',
  properties: {
    resposta: { type: 'string' },
    numero: { type: 'integer' }
  },
  required: ['resposta', 'numero'],
  additionalProperties: false,
}

async function testar(nome, params) {
  console.log('\n=== ' + nome + ' ===')
  try {
    const stream = client.messages.stream(params)
    const final = await stream.finalMessage()
    console.log('OK stop_reason:', final.stop_reason)
    console.log('content:', JSON.stringify(final.content).slice(0, 300))
  } catch (e) {
    console.log('ERRO:', e.message)
    console.log('status:', e.status)
    if (e.error) console.log('detail:', JSON.stringify(e.error).slice(0, 400))
  }
}

await testar('1) basico opus-5', {
  model: 'claude-opus-5',
  max_tokens: 500,
  messages: [{ role: 'user', content: 'Diga oi' }],
})

await testar('2) opus-5 + thinking adaptive', {
  model: 'claude-opus-5',
  max_tokens: 500,
  thinking: { type: 'adaptive' },
  messages: [{ role: 'user', content: 'Diga oi' }],
})

await testar('3) opus-5 + thinking + output_config effort', {
  model: 'claude-opus-5',
  max_tokens: 500,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  messages: [{ role: 'user', content: 'Diga oi' }],
})

await testar('4) opus-5 + thinking + output_config format json_schema', {
  model: 'claude-opus-5',
  max_tokens: 500,
  thinking: { type: 'adaptive' },
  output_config: {
    effort: 'high',
    format: { type: 'json_schema', schema: SIMPLE_SCHEMA },
  },
  messages: [{ role: 'user', content: 'Diga oi, use resposta="oi" e numero=1' }],
})

await testar('5) opus-5 alto max_tokens (32000)', {
  model: 'claude-opus-5',
  max_tokens: 32000,
  thinking: { type: 'adaptive' },
  output_config: {
    effort: 'high',
    format: { type: 'json_schema', schema: SIMPLE_SCHEMA },
  },
  messages: [{ role: 'user', content: 'Diga oi, use resposta="oi" e numero=1' }],
})
