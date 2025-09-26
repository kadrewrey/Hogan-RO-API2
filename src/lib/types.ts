// lib/types.ts
// Common type definitions for the Hogan RO API

export interface DeliveryAddress {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
}

export interface AttachmentMetadata {
  filename: string;
  originalName?: string;
  url: string;
  size: number;
  mimeType?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PurchaseOrder {
  id: string;
  division_id: string;
  created_by: string;
  supplier_id?: string;
  order_type: 'single' | 'rolling';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'delivered' | 'invoiced' | 'exceptions';
  total_value_cents: number;
  delivery_address_id?: string;
  order_end_date?: string;
  tags?: string[];
  attachments?: AttachmentMetadata[];
  comments?: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  deleted_at?: string;
}

export interface PurchaseOrderWithDelivery extends PurchaseOrder {
  delivery_address?: DeliveryAddress;
}

export interface POLine {
  id: string;
  po_id: string;
  line_no: number;
  sku?: string;
  description?: string;
  qty: number;
  unit_price_cents: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
}

export interface Division {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
}

export interface User {
  id: string;
  sub: string; // Auth0/JWT subject
  email: string;
  name?: string;
  role: 'basic' | 'manager' | 'admin';
  division_id?: string;
  spending_limit_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Invoice {
  id: string;
  po_id: string;
  supplier_invoice_no: string;
  invoice_date: string;
  invoice_file_url?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
}

export interface Delivery {
  id: string;
  po_id: string;
  delivered_at: string;
  pod_file_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at?: string;
}

// Request/Response DTOs
export interface CreateDeliveryAddressRequest {
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active?: boolean;
}

export interface UpdateDeliveryAddressRequest {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_active?: boolean;
}

export interface CreatePurchaseOrderRequest {
  supplier_id?: string;
  order_type?: 'single' | 'rolling';
  delivery_address_id?: string;
  order_end_date?: string;
  tags?: string[];
  comments?: string;
  attachments?: AttachmentMetadata[];
  lines: {
    line_no: number;
    sku?: string;
    description?: string;
    qty: number;
    unit_price_cents: number;
  }[];
}

export interface UpdatePurchaseOrderRequest {
  supplier_id?: string;
  order_type?: 'single' | 'rolling';
  delivery_address_id?: string;
  order_end_date?: string;
  tags?: string[];
  comments?: string;
  attachments?: AttachmentMetadata[];
  lines?: {
    line_no: number;
    sku?: string;
    description?: string;
    qty: number;
    unit_price_cents: number;
  }[];
}

export interface FileUploadResponse {
  success: boolean;
  uploadUrl?: string;
  key?: string;
  error?: string;
}

// API Response types
export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Fastify-specific types
export interface AuthenticatedUser {
  id: string;
  sub: string;
  email: string;
  name?: string;
  role: 'basic' | 'manager' | 'admin';
  division_id?: string;
  spending_limit_cents: number;
}