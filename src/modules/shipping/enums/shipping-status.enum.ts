export enum ShippingStatus {
  Pending = 'Pending',                  // Chưa tạo đơn GHN
  Shipped = 'Shipped',                  // Đã gửi đơn GHN
  DeliveredToCustomer = 'DeliveredToCustomer', // Đã giao cho khách
  PickupRequested = 'PickupRequested',  // Yêu cầu lấy hàng
  SampleInTransit = 'SampleInTransit',  // Mẫu đang gửi về lab
  ReturnedToLab = 'ReturnedToLab',      // Mẫu đã về lab
  Failed = 'Failed',                    // Thất bại / hủy đơn
}
