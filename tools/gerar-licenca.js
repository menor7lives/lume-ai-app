// Gera códigos de licença para os planos pagos.
//
// Uso:
//   node tools/gerar-licenca.js plus 30
//   node tools/gerar-licenca.js pro 90
//
// Requer LICENSE_SECRET no .env (mínimo 16 caracteres). O mesmo segredo precisa
// estar no servidor que valida o código. Nunca publique esse segredo.

import 'dotenv/config';
import { generateLicense } from '../server/plans.js';

const plan = process.argv[2];
const days = Number(process.argv[3] || 30);

try {
  const code = generateLicense(plan, days);
  console.log('');
  console.log('  ✅ Licença gerada');
  console.log(`  Plano: ${String(plan).toUpperCase()}`);
  console.log(`  Validade: ${days} dia(s)`);
  console.log('');
  console.log(`  ${code}`);
  console.log('');
  console.log('  Envie este código para o cliente ativar em: Planos → Já tem um código?');
  console.log('');
} catch (err) {
  console.error(`\n  [ERRO] ${err.message}\n`);
  process.exit(1);
}
