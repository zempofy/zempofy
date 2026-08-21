// Prova de ponta a ponta que a conexão com o Cloudflare R2 está funcionando — sobe um arquivo de
// teste, busca de volta e confere o conteúdo, depois apaga. Sem tela nem rota envolvida.
//
// Uso: node scripts/testarConexaoR2.js

require('dotenv').config();
const { subirArquivo, buscarArquivo, apagarArquivo } = require('../services/storage');

const CHAVE_TESTE = `_teste-conexao/zempofy-${Date.now()}.txt`;
const CONTEUDO_TESTE = `Teste de conexão R2 — ${new Date().toISOString()}`;

(async () => {
  const obrigatorias = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET_NAME'];
  const faltando = obrigatorias.filter(v => !process.env[v]);
  if (faltando.length) {
    console.error(`❌ Variável(is) de ambiente faltando: ${faltando.join(', ')}`);
    process.exit(1);
  }

  let falhou = false;

  try {
    await subirArquivo(CHAVE_TESTE, Buffer.from(CONTEUDO_TESTE, 'utf-8'), 'text/plain');
    console.log('✅ Upload: arquivo de teste enviado pro bucket.');
  } catch (err) {
    console.error('❌ Upload falhou:', err.message);
    falhou = true;
  }

  if (!falhou) {
    try {
      const buffer = await buscarArquivo(CHAVE_TESTE);
      const conteudoLido = buffer.toString('utf-8');
      if (conteudoLido === CONTEUDO_TESTE) {
        console.log('✅ Download: conteúdo lido bate com o que foi enviado.');
      } else {
        console.error('❌ Download: conteúdo lido é diferente do esperado.');
        console.error('   Esperado:', CONTEUDO_TESTE);
        console.error('   Recebido:', conteudoLido);
        falhou = true;
      }
    } catch (err) {
      console.error('❌ Download falhou:', err.message);
      falhou = true;
    }
  }

  try {
    await apagarArquivo(CHAVE_TESTE);
    console.log('✅ Exclusão: arquivo de teste removido do bucket.');
  } catch (err) {
    console.error('❌ Exclusão falhou:', err.message);
    falhou = true;
  }

  if (falhou) {
    console.log('\n⚠️  Conexão com o R2 apresentou problema(s) — ver mensagens acima.');
    process.exit(1);
  } else {
    console.log('\n🎉 Conexão com o R2 funcionando de ponta a ponta.');
  }
})();
