const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  dashboard: 'Painel',
  users: 'Usuários',
  'human-resources': 'Recursos Humanos',
  'personnel-department': 'Departamento Pessoal',
  commercial: 'Comercial',
  purchasing: 'Compras',
  maintenance: 'Manutenção',
  monitoring: 'Monitoramento',
  operations: 'Operacional',
  cleaning: 'Limpeza',
  drivers: 'Motoristas',
  financial: 'Financeiro',
  clients: 'Cadastro',
  'ai-agents': 'Agentes de IA',
  'whatsapp-conversations': 'Painel WhatsApp',
  manuals: 'Manuais',
  reports: 'Relatórios',
  settings: 'Configurações',
  license: 'Licença',
  profile: 'Perfil',
  contracts: 'Contratos',
  quotes: 'Orçamentos',
  trips: 'Viagens',
  documents: 'Documentos',
  invoices: 'Faturas',
  'service-requests': 'Solicitações de serviço',
  support: 'Suporte',
  'route-planner': 'Roteirização rodoviária',
};

const ACTION_LABELS: Readonly<Record<string, string>> = {
  view: 'Visualizar',
  create: 'Criar',
  update: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar',
  use: 'Utilizar',
  approve: 'Aprovar',
  export: 'Exportar',
  publish: 'Publicar',
  calculate: 'Calcular rotas e custos',
};

export function getPermissionResourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? 'Módulo adicional';
}

export function getPermissionActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? 'Ação disponível';
}

export function getPermissionCodeLabel(resource: string, action: string): string {
  if (resource === 'users') {
    if (action === 'create') return 'Criar usuário';
    if (action === 'update') return 'Editar acesso';
    if (action === 'manage') return 'Gerenciar acesso';
  }

  return getPermissionActionLabel(action);
}
