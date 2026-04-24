#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function normalize(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^"|"$/g, '');
}

function isPlaceholder(value) {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return true;

  const exactPlaceholders = new Set([
    'dev_password_placeholder',
    'your-db-password-here',
    'your-db-password',
    'placeholder',
    'dummy',
    'changeme',
  ]);

  if (exactPlaceholders.has(normalized)) {
    return true;
  }

  return (
    normalized.includes('placeholder') ||
    normalized.includes('example') ||
    normalized.startsWith('your-') ||
    normalized.startsWith('dummy-')
  );
}

function readProjectRef() {
  const projectRefPath = path.join(process.cwd(), 'supabase', '.temp', 'project-ref');
  if (!fs.existsSync(projectRefPath)) return '';
  return normalize(fs.readFileSync(projectRefPath, 'utf8'));
}

function main() {
  const password = normalize(process.env.SUPABASE_DB_PASSWORD);
  const projectRef = readProjectRef();

  if (isPlaceholder(password)) {
    console.error('❌ Supabase CLI direct DB auth is not configured.');
    console.error('');
    console.error(
      'SUPABASE_DB_PASSWORD is missing or still set to a placeholder value.'
    );
    console.error(
      'This does not block the app runtime, but it will break direct DB commands such as:'
    );
    console.error('- supabase migration list');
    console.error('- supabase db pull');
    console.error('- supabase db push');
    if (projectRef) {
      console.error('');
      console.error(`Current linked project ref: ${projectRef}`);
    }
    console.error('');
    console.error('Next step: replace SUPABASE_DB_PASSWORD in .env.local with the real remote DB password.');
    process.exit(1);
  }

  console.log('✅ Supabase CLI direct DB password is configured.');
  if (projectRef) {
    console.log(`Linked project ref: ${projectRef}`);
  }
  console.log('You can proceed with direct DB commands such as migration list/db pull/db push.');
}

main();
