import { ShippingStatus } from '@prisma/client';

export function mapGhtkStatusToShipping(statusId: number): ShippingStatus {
  switch (statusId) {
    case 1: return 'Pending';
    case 2: return 'Shipped';
    case 3: return 'DeliveredToCustomer';
    case 4: return 'SampleInTransit';
    case 5: return 'ReturnedToLab'; 
    case 6: return 'Failed';
    default: return 'Pending';
  }
}
