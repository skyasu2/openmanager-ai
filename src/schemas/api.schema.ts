/**
 * 📡 API Schema Index - Modular Architecture
 *
 * Centralized export point for runtime-facing API schemas
 * - Keeps the public surface aligned with active route contracts
 * - Domain-specific legacy schemas can still be imported directly
 * - Avoids exporting stale modules that are not wired into runtime validation
 *
 * Modules:
 * - AI: AI queries, responses, and analysis
 * - Dashboard: Dashboard APIs and data
 * - Health: System health checks and monitoring
 * - MCP: Model Context Protocol communications
 * - Server: Server management and metrics
 * - Alert: Alert management and rules
 * - Common: Shared schemas and utilities
 */

// ===== AI Schemas =====
export * from './api.ai.schema';

// ===== Alert Schemas =====
export * from './api.alert.schema';

// ===== Common API Schemas =====
export * from './api.common.schema';

// ===== Dashboard Schemas =====
export * from './api.dashboard.schema';

// ===== Health Check Schemas =====
export * from './api.health.schema';

// ===== MCP Schemas =====
export * from './api.mcp.schema';

// ===== Server Schemas =====
export * from './api.server.schema';

/**
 * 🎯 Architecture Benefits:
 *
 * Before: 1859 lines monolithic file
 * After: focused runtime modules + direct imports for legacy domains
 *
 * - 📦 Modular: Each domain has its own file
 * - 🔍 Discoverable: Clear module organization
 * - 🛠️ Maintainable: Easy to locate and update schemas
 * - 🔄 Reusable: Direct imports remain available for niche domains
 * - ⚡ Performance: Better tree-shaking and bundling
 */
