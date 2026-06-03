-- Migração: Adicionar campos de endereço à tabela reward_claims
-- Data: 2026-06-02

ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS estado TEXT;
