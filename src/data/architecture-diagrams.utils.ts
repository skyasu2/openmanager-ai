import type {
  ArchitectureDiagram,
  ArchitectureDiagramView,
  DiagramConnection,
  DiagramLayer,
  DiagramNode,
} from './architecture-diagrams.types';

export type ArchitectureHopTarget = {
  node: DiagramNode;
  label?: string;
  type: 'solid' | 'dashed';
};

export type ArchitectureHop = {
  from: DiagramNode;
  fromLayerIndex: number;
  toLayerIndex: number;
  targets: ArchitectureHopTarget[];
};

export function dedupeConnectionLabels(
  connections: DiagramConnection[]
): DiagramConnection[] {
  const seen = new Set<string>();
  return connections.map((connection) => {
    if (!connection.label) return connection;
    const key = `${connection.from}::${connection.label}`;
    if (seen.has(key)) {
      const unlabeled: DiagramConnection = {
        from: connection.from,
        to: connection.to,
      };
      if (connection.type) unlabeled.type = connection.type;
      return unlabeled;
    }
    seen.add(key);
    return connection;
  });
}

export function resolveDiagramView(
  diagram: ArchitectureDiagram,
  viewId?: string | null
): ArchitectureDiagram {
  const views = diagram.views;
  if (!views || views.length === 0) return diagram;

  const view = views.find((candidate) => candidate.id === viewId) ?? views[0];
  if (!view) return diagram;

  return applyDiagramView(diagram, view);
}

export function buildArchitectureHops(
  layers: DiagramLayer[],
  connections: DiagramConnection[] | undefined
): ArchitectureHop[] {
  const nodeLayer = new Map<
    string,
    { node: DiagramNode; layerIndex: number }
  >();
  layers.forEach((layer, layerIndex) => {
    for (const node of layer.nodes) {
      nodeLayer.set(node.id, { node, layerIndex });
    }
  });

  const hops = new Map<string, ArchitectureHop>();
  for (const connection of connections ?? []) {
    const from = nodeLayer.get(connection.from);
    const to = nodeLayer.get(connection.to);
    if (!from || !to) continue;

    const key = `${from.node.id}::${to.layerIndex}`;
    const target: ArchitectureHopTarget = {
      node: to.node,
      type: connection.type ?? 'solid',
    };
    if (connection.label) target.label = connection.label;

    const existing = hops.get(key);
    if (existing) {
      existing.targets.push(target);
      continue;
    }

    hops.set(key, {
      from: from.node,
      fromLayerIndex: from.layerIndex,
      toLayerIndex: to.layerIndex,
      targets: [target],
    });
  }

  return [...hops.values()];
}

export function applyDiagramView(
  diagram: ArchitectureDiagram,
  view: ArchitectureDiagramView
): ArchitectureDiagram {
  return {
    ...diagram,
    id: `${diagram.id}-${view.id}`,
    title: view.title ?? diagram.title,
    description: view.description ?? diagram.description,
    layers: view.layers,
    connections: view.connections ?? [],
  };
}
