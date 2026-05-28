/**
 * Domain bootstrap
 *
 * Importing this module registers built-in domain runtime hosts with the
 * domain registry. Keep supervisor and agent entrypoints importing this
 * module before they call getDefaultDomainHost().
 */

import './monitoring-runtime-host';
