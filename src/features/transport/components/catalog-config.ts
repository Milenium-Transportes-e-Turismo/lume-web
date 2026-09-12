import type { CatalogResource } from '../domain/contracts';
import type { Field, Row } from './transport-ui';

const choice = (values: string[][]) => values.map(([value, label]) => ({ value, label }));
const company: Field = {
  name: 'supplierRegistrationId',
  label: 'Empresa prestadora (nome fantasia)',
  required: true,
  lookup: 'companies',
  completeLookup: true,
};
const valid: Field[] = [
  { name: 'validFrom', label: 'Início de vigência', type: 'date', required: true },
  { name: 'validUntil', label: 'Fim de vigência', type: 'date' },
];
const active: Field = { name: 'active', label: 'Ativo', type: 'checkbox' };
export const catalogs: Record<
  CatalogResource,
  {
    label: string;
    permission: 'clients' | 'trips' | 'contracts';
    fields: Field[];
    columns: [string, string][];
    help: string;
  }
> = {
  companies: {
    label: 'CNPJs do tenant',
    permission: 'clients',
    help: 'Cadastre os CNPJs das empresas que compõem este tenant. Clientes e funcionários pertencem ao Cadastro. A inativação preserva os dados e o histórico da empresa.',
    fields: [
      { name: 'cnpj', label: 'CNPJ', required: true },
      { name: 'legalName', label: 'Razão social', required: true },
      { name: 'tradeName', label: 'Nome fantasia', required: true },
    ],
    columns: [
      ['tradeName', 'Nome fantasia'],
      ['legalName', 'Razão social'],
      ['cnpj', 'CNPJ'],
      ['active', 'Ativa'],
    ],
  },
  fleet: {
    label: 'Frota',
    permission: 'trips',
    help: 'A empresa do veículo é independente da empresa do cliente. A modalidade da viagem é definida no contrato do Lume.',
    fields: [
      { name: 'fleetCode', label: 'Frota', required: true },
      { ...company, immutable: true },
      {
        name: 'validFrom',
        label: 'Início do vínculo com a empresa',
        type: 'date',
        immutable: true,
        hint: 'Informe a data histórica quando conhecida.',
      },
      { name: 'plate', label: 'Placa' },
      { name: 'serviceTypeId', label: 'Tipo de serviço', lookup: 'catalogs?kind=service-type' },
      { name: 'vehicleTypeId', label: 'Tipo de veículo', lookup: 'catalogs?kind=vehicle-type' },
      { name: 'categoryId', label: 'Categoria', lookup: 'catalogs?kind=category' },
      { name: 'axles', label: 'Quantidade de eixos', type: 'number' },
      { name: 'passengers', label: 'Quantidade de passageiros', type: 'number' },
      { name: 'model', label: 'Modelo automotivo' },
    ],
    columns: [
      ['fleetCode', 'Frota'],
      ['plate', 'Placa'],
      ['model', 'Modelo'],
      ['active', 'Ativo'],
    ],
  },
  catalogs: {
    label: 'Tipos e categorias',
    permission: 'trips',
    help: 'Amplie os tipos de serviço, veículos e categorias sem alterar registros antigos.',
    fields: [
      {
        name: 'kind',
        label: 'Catálogo',
        required: true,
        choices: choice([
          ['service-type', 'Tipo de serviço'],
          ['vehicle-type', 'Tipo de veículo'],
          ['category', 'Categoria'],
        ]),
      },
      { name: 'name', label: 'Nome', required: true },
    ],
    columns: [
      ['name', 'Nome'],
      ['kind', 'Catálogo'],
      ['code', 'Código'],
      ['active', 'Ativo'],
    ],
  },
  affiliations: {
    label: 'Vínculos de clientes e funcionários',
    permission: 'clients',
    help: 'Selecione o cadastro PF/PJ já existente. O vínculo usa a empresa prestadora do Lume. Para mudar a empresa, encerre a vigência anterior e crie um novo vínculo. Registros antigos mantêm seu contexto.',
    fields: [
      {
        name: 'registrationId',
        label: 'Cliente ou funcionário',
        required: true,
        lookup: 'lookups/registrations',
        immutable: true,
      },
      { ...company, immutable: true },
      {
        name: 'role',
        label: 'Vínculo',
        required: true,
        immutable: true,
        choices: choice([
          ['client', 'Cliente'],
          ['employee', 'Funcionário'],
        ]),
      },
      { ...valid[0], immutable: true },
      valid[1],
    ],
    columns: [
      ['role', 'Vínculo'],
      ['validFrom', 'Vigência inicial'],
      ['validUntil', 'Vigência final'],
    ],
  },
  contracts: {
    label: 'Contratos',
    permission: 'contracts',
    help: 'O cliente pode ter contratos de modalidades diferentes simultaneamente. Configure as condições de KM e sua vigência no detalhe de cada contrato.',
    fields: [
      {
        name: 'clientRegistrationId',
        label: 'Cliente PF ou PJ',
        required: true,
        lookup: 'lookups/registrations',
      },
      company,
      { name: 'code', label: 'Código do contrato', required: true },
      { name: 'name', label: 'Nome do contrato', required: true },
      {
        name: 'modality',
        label: 'Modalidade',
        required: true,
        choices: choice([
          ['continuous', 'Contínuo'],
          ['occasional', 'Eventual'],
          ['rental', 'Locação'],
        ]),
      },
      ...valid,
      {
        name: 'status',
        label: 'Situação',
        required: true,
        choices: choice([
          ['draft', 'Rascunho'],
          ['active', 'Ativo'],
          ['suspended', 'Suspenso'],
          ['ended', 'Encerrado'],
        ]),
      },
    ],
    columns: [
      ['name', 'Contrato'],
      ['code', 'Código'],
      ['modality', 'Modalidade'],
      ['status', 'Situação'],
      ['validFrom', 'Vigência inicial'],
    ],
  },
  routes: {
    label: 'Rotas de origem',
    permission: 'contracts',
    help: 'Associe a rota ao contrato uma vez, com vigência. Confirme o significado do ID externo antes de mapear; nomes novos ou ambíguos precisam de revisão.',
    fields: [
      { name: 'provider', label: 'Origem', required: true, choices: choice([['avic', 'Avic']]) },
      {
        name: 'externalId',
        label: 'ID externo confirmado',
        hint: 'Mantenha o identificador como texto, inclusive IDs grandes.',
      },
      { name: 'name', label: 'Nome da rota / Motivo', required: true },
    ],
    columns: [
      ['name', 'Rota / Motivo'],
      ['externalId', 'ID externo'],
      ['provider', 'Origem'],
    ],
  },
};
export function fieldsFor(resource: CatalogResource, row?: Row): Field[] {
  return [
    ...catalogs[resource].fields.map((field) =>
      resource === 'fleet' && field.lookup ? { ...field, completeLookup: true } : field,
    ),
    ...(row && (resource === 'fleet' || resource === 'catalogs') ? [active] : []),
  ];
}
export const conditionFields: Field[] = [
  ...valid,
  {
    name: 'period',
    label: 'Comparação',
    required: true,
    choices: choice([
      ['daily', 'Diária'],
      ['monthly', 'Mensal'],
    ]),
  },
  {
    name: 'allowanceKm',
    label: 'KM contratado (opcional)',
    type: 'decimal',
    hint: 'Em branco significa sem franquia; não equivale a zero.',
  },
  { name: 'includeGarage', label: 'Incluir deslocamentos de garagem', type: 'checkbox' },
  { name: 'transitionMonth', label: 'Mês de transição (opcional)', type: 'month' },
  {
    name: 'transitionAllowanceKm',
    label: 'KM específico do mês de transição',
    type: 'decimal',
    hint: 'Só informe quando houver uma condição combinada para o mês.',
  },
];
export const assignmentFields: Field[] = [
  { name: 'contractId', label: 'Contrato', required: true, lookup: 'contracts' },
  ...valid,
];
export const labels: Record<string, string> = {
  continuous: 'Contínuo',
  occasional: 'Eventual',
  rental: 'Locação',
  draft: 'Rascunho',
  active: 'Ativo',
  suspended: 'Suspenso',
  ended: 'Encerrado',
  client: 'Cliente',
  employee: 'Funcionário',
  daily: 'Diária',
  monthly: 'Mensal',
  'service-type': 'Tipo de serviço',
  'vehicle-type': 'Tipo de veículo',
  category: 'Categoria',
  avic: 'Avic',
};
