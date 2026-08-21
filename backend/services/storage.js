// Conexão crua com o Cloudflare R2 (compatível com a API do S3) — só "conversa com o bucket",
// sem validação de tipo/tamanho de arquivo (isso fica pro spec de "Documentos por cliente").
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

// Sobe um arquivo pro bucket. `chave` é o caminho/nome do objeto (ex: "clientes/123/nota.pdf").
async function subirArquivo(chave, buffer, tipoConteudo) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: chave,
    Body: buffer,
    ContentType: tipoConteudo,
  }));
}

// Busca um arquivo do bucket e retorna o conteúdo como Buffer.
async function buscarArquivo(chave) {
  const resposta = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: chave }));
  const pedacos = [];
  for await (const pedaco of resposta.Body) pedacos.push(pedaco);
  return Buffer.concat(pedacos);
}

// Remove um arquivo do bucket.
async function apagarArquivo(chave) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave }));
}

module.exports = { subirArquivo, buscarArquivo, apagarArquivo };
