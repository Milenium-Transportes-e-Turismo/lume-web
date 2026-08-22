export type RoutingCompanyStatus = 'active' | 'inactive' | 'suspended';
export type RoutingClientType = 'pf' | 'pj';

export interface RoutingPhone {
  readonly number: string;
  readonly description?: string | null;
}

export interface RoutingCompany {
  readonly id: string;
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly costCenter: string | null;
  readonly clientType: RoutingClientType;
  readonly avicExternalId: string | null;
  readonly individualName: string | null;
  readonly cpf: string | null;
  readonly individualEmail: string | null;
  readonly individualWhatsapp: string | null;
  readonly individualPhones: readonly RoutingPhone[];
  readonly cnpj: string | null;
  readonly legalEmail: string | null;
  readonly legalWhatsapp: string | null;
  readonly legalPhones: readonly RoutingPhone[];
  readonly status: RoutingCompanyStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RoutingCompanyComment {
  readonly id: string;
  readonly comment: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RoutingCompanyHistory {
  readonly id: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly beforeSnapshot: Readonly<Record<string, unknown>> | null;
  readonly afterSnapshot: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface RoutingFixedPoint {
  readonly id: string;
  readonly routingCompanyId: string | null;
  readonly code: string;
  readonly name: string;
  readonly status: 'active' | 'inactive';
  readonly address: RoutingAddress;
  readonly version: number;
}

export interface RoutingAddress {
  readonly label: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string | null;
  readonly district: string;
  readonly postalCode: string;
  readonly city: string;
  readonly state: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface RoutingContractShift {
  readonly id?: string;
  readonly name: string;
  readonly requiredArrivalTime: string;
  readonly vehicleCount: number | null;
  readonly vehicleCapacity: number | null;
  readonly activeWeekdays: readonly number[];
}

export interface RoutingContract {
  readonly id: string;
  readonly routingCompanyId: string;
  readonly originFixedPointId: string | null;
  readonly destinationFixedPointId: string | null;
  readonly code: string;
  readonly name: string;
  readonly operationType: string;
  readonly routeType: 'municipal' | 'intermunicipal';
  readonly status: 'draft' | 'active' | 'suspended' | 'ended';
  readonly periodicity: 'monthly' | 'weekly' | 'daily' | 'per-route';
  readonly contractedVehicleCount: number;
  readonly predictedVehicleName: string;
  readonly predictedVehicleCapacity: number;
  readonly contractedKm: number | null;
  readonly plannedKm: number | null;
  readonly unitName: string;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly costCenters: readonly {
    readonly id?: string;
    readonly code: string;
    readonly name: string | null;
  }[];
  readonly shifts: readonly RoutingContractShift[];
  readonly version: number;
}

export interface RoutingPassengerImport {
  readonly batch: {
    readonly id: string;
    readonly status: 'processing' | 'completed' | 'review-required' | 'failed';
    readonly totalRows: number;
    readonly createdCount: number;
    readonly updatedCount: number;
    readonly keptCount: number;
    readonly pendingCount: number;
    readonly conflictCount: number;
  };
  readonly records: readonly {
    readonly id: string;
    readonly rowNumber: number;
    readonly passengerId: string | null;
    readonly action: 'created' | 'updated' | 'kept' | 'conflict' | 'pending';
    readonly payload: Readonly<Record<string, unknown>>;
    readonly problems: readonly {
      readonly field: string;
      readonly reason: string;
      readonly resolutionAction: string;
    }[];
  }[];
}

export interface RoutingPassenger {
  readonly id: string;
  readonly routingCompanyId: string;
  readonly fullName: string;
  readonly externalReference: string | null;
  readonly shift: string | null;
  readonly requiredArrivalTime: string | null;
  readonly sector: string | null;
  readonly status: 'active' | 'on-leave' | 'vacation' | 'temporarily-off-route' | 'unlinked';
  readonly registrationStatus: 'ready' | 'pending';
  readonly routingEligible: boolean;
  readonly accessibilityRequired: boolean;
  readonly accessibilityNotes: string | null;
  readonly residenceStreet: string | null;
  readonly residenceNumber: string | null;
  readonly residenceComplement: string | null;
  readonly residenceDistrict: string | null;
  readonly residencePostalCode: string | null;
  readonly residenceCity: string | null;
  readonly residenceState: string | null;
  readonly documents: readonly {
    readonly documentTypeCode: string;
    readonly data: Readonly<Record<string, unknown>>;
  }[];
  readonly version: number;
}

export type RoutingRouteStatus =
  'draft' | 'routed' | 'in-review' | 'pending-approval' | 'approved' | 'published';

export interface RoutingRoute {
  readonly id: string;
  readonly routingCompanyId: string;
  readonly contractId: string;
  readonly code: string;
  readonly name: string;
  readonly shift: string;
  readonly requiredArrivalTime: string;
  readonly status: RoutingRouteStatus;
  readonly predictedVehicleName: string;
  readonly predictedVehicleCapacity: number;
  readonly plannedOutboundKm: number | null;
  readonly plannedReturnKm: number | null;
  readonly plannedTotalKm: number | null;
  readonly estimatedDurationMinutes: number | null;
  readonly overflowPassengerCount: number;
  readonly additionalRouteSuggested: boolean;
  readonly needsRerouting: boolean;
  readonly approvedVersion: number | null;
  readonly version: number;
}

export interface RoutingRouteDetail {
  readonly route: RoutingRoute;
  readonly points: readonly {
    readonly id: string;
    readonly direction: 'outbound' | 'return';
    readonly sequence: number;
    readonly address: RoutingAddress;
    readonly scheduledTime: string | null;
    readonly alerts: readonly string[];
  }[];
  readonly assignments: readonly {
    readonly id: string;
    readonly passengerId: string;
    readonly pointId: string | null;
    readonly status: 'assigned' | 'overflow' | 'pending-data' | 'pending-documents';
    readonly walkingDistanceMeters: number | null;
    readonly boardingOrder: number | null;
    readonly warnings: readonly string[];
    readonly passengerName?: string;
  }[];
  readonly navigationLinks?: readonly {
    readonly label: string;
    readonly url: string;
    readonly direction: 'outbound' | 'return';
    readonly sequence: number;
  }[];
}

export interface RoutingList<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export interface RoutingBinary {
  readonly content: ArrayBuffer;
  readonly contentType: string;
  readonly fileName: string;
}
