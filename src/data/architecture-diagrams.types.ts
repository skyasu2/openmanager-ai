export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'primary' | 'secondary' | 'tertiary' | 'highlight';
  icon?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  type?: 'solid' | 'dashed';
}

export interface DiagramLayer {
  title: string;
  color: string;
  nodes: DiagramNode[];
}

export interface ArchitectureDiagram {
  id: string;
  title: string;
  description: string;
  layers: DiagramLayer[];
  connections?: DiagramConnection[];
}
