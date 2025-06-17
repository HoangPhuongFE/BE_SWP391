export interface GhtkCreateOrderDto {
  order: {
    id: string;
    pick_name: string;
    pick_address: string;
    pick_province: string;
    pick_district: string;
    pick_tel: string;

    name: string;
    address: string;
    province: string;
    district: string;
    tel: string;

    note?: string;
    value?: number;
    pick_money?: number;
    is_freeship?: boolean;
  };
}
