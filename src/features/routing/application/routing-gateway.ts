import type {
  RoutingBinary,
  RoutingCompany,
  RoutingCompanyComment,
  RoutingCompanyHistory,
  RoutingContract,
  RoutingFixedPoint,
  RoutingList,
  RoutingPassenger,
  RoutingPassengerImport,
  RoutingRoute,
  RoutingRouteDetail,
  RoutingRouteStatus,
} from '../domain/routing';

export type RoutingErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not-found'
  | 'invalid-response'
  | 'service-unavailable';

export class RoutingError extends Error {
  constructor(
    readonly code: RoutingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

export interface RoutingGateway {
  listCompanies(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    clientType?: string;
    sort?: string;
  }): Promise<RoutingList<RoutingCompany>>;
  createCompany(input: Record<string, unknown>): Promise<RoutingCompany>;
  updateCompany(id: string, input: Record<string, unknown>): Promise<RoutingCompany>;
  deleteCompany(id: string, password: string): Promise<{ deleted: true }>;
  getCompany(id: string): Promise<RoutingCompany>;
  listCompanyComments(id: string): Promise<readonly RoutingCompanyComment[]>;
  addCompanyComment(id: string, comment: string): Promise<RoutingCompanyComment>;
  updateCompanyComment(
    id: string,
    commentId: string,
    comment: string,
  ): Promise<RoutingCompanyComment>;
  removeCompanyComment(id: string, commentId: string): Promise<{ removed: true }>;
  listCompanyHistory(id: string): Promise<readonly RoutingCompanyHistory[]>;
  listFixedPoints(query?: {
    search?: string;
    routingCompanyId?: string;
    routeId?: string;
    status?: string;
  }): Promise<RoutingList<RoutingFixedPoint>>;
  createFixedPoint(input: Record<string, unknown>): Promise<RoutingFixedPoint>;
  listContracts(query?: {
    routingCompanyId?: string;
    search?: string;
    status?: string;
  }): Promise<RoutingList<RoutingContract>>;
  createContract(input: Record<string, unknown>): Promise<RoutingContract>;
  listPassengers(query?: {
    page?: number;
    pageSize?: number;
    routingCompanyId?: string;
    search?: string;
    status?: string;
    registrationStatus?: string;
  }): Promise<RoutingList<RoutingPassenger>>;
  createPassenger(input: Record<string, unknown>): Promise<RoutingPassenger>;
  updatePassenger(id: string, input: Record<string, unknown>): Promise<RoutingPassenger>;
  passengerTemplate(routingCompanyId?: string): Promise<RoutingBinary>;
  importPassengers(
    file: File,
    commandId: string,
    routingCompanyId: string,
  ): Promise<RoutingPassengerImport>;
  getPassengerImport(batchId: string): Promise<RoutingPassengerImport>;
  resolvePassengerImportAddress(
    batchId: string,
    recordId: string,
    input: Record<string, unknown>,
  ): Promise<RoutingPassengerImport>;
  resolvePassengerImportData(
    batchId: string,
    recordId: string,
    input: Record<string, unknown>,
  ): Promise<RoutingPassengerImport>;
  listRoutes(query?: {
    routingCompanyId?: string;
    search?: string;
    status?: string;
  }): Promise<RoutingList<RoutingRoute>>;
  getRoute(routeId: string): Promise<RoutingRouteDetail>;
  generateRoutes(
    contractId: string,
    serviceDate: string,
    shiftId?: string,
  ): Promise<{ readonly routes: readonly RoutingRouteDetail[] }>;
  transitionRoute(
    routeId: string,
    status: RoutingRouteStatus,
    expectedVersion: number,
  ): Promise<RoutingRouteDetail>;
  approveRoute(routeId: string, expectedVersion: number): Promise<RoutingRouteDetail>;
  publishRoute(routeId: string, expectedVersion: number): Promise<RoutingRouteDetail>;
  downloadRoute(
    routeId: string,
    format: 'pdf' | 'xlsx' | 'my-maps.xlsx' | 'my-maps.csv',
  ): Promise<RoutingBinary>;
}
