// Máscaras e formatação usadas pelas telas do Contábil. Mesma lógica de mascaraCPF/formatMoeda do
// Clientes.jsx (que não são exportadas) — TODO consolidar depois.

export const mascaraCPF = (v = '') => String(v).replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2')

export const soDigitos = (v = '') => String(v || '').replace(/\D/g, '')

// `v ? ... : '—'` trataria 0 como vazio — aqui 0 aparece como R$ 0,00
// (negativo sai como "-R$ 10,00", não "R$ -10,00")
export const formatMoeda = (v) => (v || v === 0)
  ? `${Number(v) < 0 ? '-' : ''}R$ ${Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'

// Mesma regra do campo de honorário do cadastro: digita só números, os 2 últimos são centavos
export const moedaParaInput = (v) => (v || v === 0) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
export const inputParaMoeda = (texto) => { const nums = String(texto).replace(/\D/g, ''); return nums ? parseInt(nums, 10) / 100 : '' }
