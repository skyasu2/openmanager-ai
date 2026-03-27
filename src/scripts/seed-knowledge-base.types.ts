export interface KnowledgeEntry {
  title: string;
  content: string;
  category:
    | 'incident'
    | 'troubleshooting'
    | 'best_practice'
    | 'command'
    | 'architecture';
  tags: string[];
  severity: 'info' | 'warning' | 'critical';
  related_server_types: string[];
}
