#!/usr/bin/env bun

/**
 * Script para verificar se as variáveis de ambiente estão sendo carregadas corretamente
 * Execute com: bun run src/scripts/check-env.ts
 */

console.log("🔍 Verificando variáveis de ambiente...\n");

// Verificar OPENAI_API_KEY
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  const trimmed = openaiKey.trim();
  if (trimmed.length > 0) {
    // Mostrar apenas os primeiros 10 e últimos 4 caracteres para segurança
    const masked = `${trimmed.substring(0, 10)}...${trimmed.substring(
      trimmed.length - 4
    )}`;
    console.log("✅ OPENAI_API_KEY encontrada:");
    console.log(`   Comprimento: ${trimmed.length} caracteres`);
    console.log(`   Valor (mascarado): ${masked}`);
    console.log(`   Começa com "sk-": ${trimmed.startsWith("sk-")}`);
  } else {
    console.log("❌ OPENAI_API_KEY está vazia (apenas espaços em branco)");
  }
} else {
  console.log("❌ OPENAI_API_KEY não encontrada em process.env");
}

console.log("");

// Verificar ANTHROPIC_API_KEY
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (anthropicKey) {
  const trimmed = anthropicKey.trim();
  if (trimmed.length > 0) {
    const masked = `${trimmed.substring(0, 10)}...${trimmed.substring(
      trimmed.length - 4
    )}`;
    console.log("✅ ANTHROPIC_API_KEY encontrada:");
    console.log(`   Comprimento: ${trimmed.length} caracteres`);
    console.log(`   Valor (mascarado): ${masked}`);
  } else {
    console.log("❌ ANTHROPIC_API_KEY está vazia (apenas espaços em branco)");
  }
} else {
  console.log("⚠️  ANTHROPIC_API_KEY não encontrada (opcional)");
}

console.log("\n📝 Dicas:");
console.log(
  "   - O arquivo .env deve estar na raiz do projeto ou na raiz do backend"
);
console.log(
  "   - Certifique-se de que a chave não tem espaços extras ou quebras de linha"
);
console.log('   - A chave da OpenAI deve começar com "sk-"');
console.log("   - Reinicie o servidor após modificar o arquivo .env");



