import {
  getPermissionActionLabel,
  getPermissionCodeLabel,
  getPermissionResourceLabel,
} from './permission-labels';

describe('permission labels', () => {
  it.each([
    ['service', 'Sessões de atendimento'],
    ['service-confirmations', 'Confirmação de serviços'],
    ['tenant', 'Administração do tenant'],
    ['routing-companies', 'Empresas da roteirização'],
    ['routing-contracts', 'Contratos de transporte'],
    ['passengers', 'Passageiros'],
    ['routes', 'Planos de rotas'],
    ['dashboard', 'Painel'],
    ['users', 'Usuários'],
    ['human-resources', 'Recursos Humanos'],
    ['personnel-department', 'Departamento Pessoal'],
    ['ai-agents', 'Agentes de IA'],
    ['whatsapp-conversations', 'Painel WhatsApp'],
    ['service-requests', 'Solicitações de serviço'],
    ['license', 'Licença'],
  ])('translates the resource %s', (resource, label) => {
    expect(getPermissionResourceLabel(resource)).toBe(label);
  });

  it.each([
    ['attend', 'Atender conversas'],
    ['assume', 'Assumir atendimento'],
    ['respond', 'Responder atendimento'],
    ['transfer', 'Transferir atendimento'],
    ['close', 'Encerrar atendimento'],
    ['priority', 'Alterar prioridade'],
    ['history', 'Consultar histórico'],
    ['import', 'Importar'],
    ['view', 'Visualizar'],
    ['create', 'Criar'],
    ['update', 'Editar'],
    ['delete', 'Excluir'],
    ['manage', 'Gerenciar'],
    ['use', 'Utilizar'],
    ['approve', 'Aprovar'],
    ['export', 'Exportar'],
  ])('translates the action %s', (action, label) => {
    expect(getPermissionActionLabel(action)).toBe(label);
  });

  it('keeps catalog additions usable without a frontend allow-list', () => {
    expect(getPermissionResourceLabel('quality-assurance')).toBe('Módulo adicional');
    expect(getPermissionActionLabel('review')).toBe('Ação disponível');
  });

  it('describes the user access boundaries explicitly', () => {
    expect(getPermissionCodeLabel('users', 'create')).toBe('Criar usuário');
    expect(getPermissionCodeLabel('users', 'update')).toBe('Editar acesso');
    expect(getPermissionCodeLabel('users', 'manage')).toBe('Gerenciar acesso');
  });
});
