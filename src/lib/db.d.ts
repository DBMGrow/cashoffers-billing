import type { ColumnType } from "kysely";

export type Decimal = ColumnType<string, number | string, number | string>;

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export interface AgentBoxes {
  active: Generated<number>;
  agentbox_id: Generated<number>;
  avm_pct: Decimal | null;
  created: Generated<Date>;
  created_user_id: number;
  data: string | null;
  expiration_days: Generated<number>;
  finalize_message: string | null;
  locked: Generated<number>;
  max: Decimal | null;
  min: Decimal | null;
  nickname: string;
  seller_notes: string | null;
  team: Generated<number>;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface AgentBoxesDash {
  active: Generated<number>;
  agentbox_id: Generated<number>;
  avm_pct: Decimal | null;
  created: Generated<Date>;
  created_user_id: number;
  data: string | null;
  expiration_days: Generated<number>;
  finalize_message: string | null;
  locked: Generated<number>;
  max: Decimal | null;
  min: Decimal | null;
  nickname: string;
  seller_notes: string | null;
  team: Generated<number>;
  team_id: number | null;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface AgentBoxRules {
  agentbox_id: number;
  agentboxrule_id: Generated<number>;
  rule_id: number;
}

export interface AgentBoxRulesDash {
  agentbox_id: number;
  agentboxrule_id: Generated<number>;
  created_rule: Generated<Date | null>;
  rule: Json | null;
  rule_id: number;
  ruletype: string | null;
}

export interface AgentBoxUsers {
  agentbox_id: number;
  created: Generated<Date>;
  status: Generated<"OPTOUT">;
  user_id: number;
}

export interface AlertRoles {
  alert_id: number;
  role_id: string;
}

export interface Alerts {
  active: number;
  alert_id: Generated<number>;
  body: string;
  expires: Date;
  is_premium: number | null;
  title: string;
}

export interface AlertWhitelabels {
  alert_id: number;
  whitelabel_id: number;
}

export interface AuditFields {
  auditfield_id: Generated<number>;
  created: Generated<Date>;
  created_user_id: number;
  fieldname: string;
  table_id: number;
  tablename: string;
  value_new: string;
  value_old: string | null;
}

export interface Audits {
  args: string;
  audit_id: Generated<number>;
  created: Generated<Date>;
  created_user_id: number;
  table_id: number;
  tablename: string;
}

export interface BuyBoxes {
  active: Generated<number>;
  autooffer: Generated<number>;
  autooffer_avm_pct: Decimal | null;
  autooffer_buyer_notes: string | null;
  autooffer_category: string | null;
  autooffer_data: string | null;
  autooffer_expiration_days: Generated<number>;
  autooffer_finalize_message: string | null;
  autooffer_max: Decimal | null;
  autooffer_min: Decimal | null;
  autooffer_nickname: string | null;
  buybox_id: Generated<number>;
  created: Generated<Date>;
  created_user_id: number;
  customer_user_id: number | null;
  description: string | null;
  nickname: string;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface BuyBoxesDash {
  active: Generated<number>;
  autooffer: Generated<number>;
  autooffer_avm_pct: Decimal | null;
  autooffer_buyer_notes: string | null;
  autooffer_data: string | null;
  autooffer_expiration_days: Generated<number>;
  autooffer_max: Decimal | null;
  autooffer_min: Decimal | null;
  autooffer_nickname: string | null;
  buybox_id: Generated<number>;
  created: Generated<Date>;
  created_user_id: number;
  customer_user_id: number | null;
  description: string | null;
  nickname: string;
  property_count: Generated<number>;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface BuyBoxRules {
  applytype: Generated<string>;
  buybox_id: number;
  buyboxrule_id: Generated<number>;
  rule_id: number;
}

export interface BuyBoxRulesDash {
  applytype: Generated<string>;
  buybox_id: number;
  buyboxrule_id: Generated<number>;
  created_rule: Generated<Date | null>;
  rule: Json | null;
  rule_id: number;
  ruletype: string | null;
}

export interface EmittedEvents {
  created_at: Generated<Date>;
  event_id: string;
  event_name: string;
  origin_request_id: string;
  origin_request_user_session: Json | null;
  payload: Json;
  payload_version: string | null;
}

export interface ErrorInstances {
  api_token: string | null;
  body: Json | null;
  code: number;
  created: Generated<Date>;
  digest_id: string | null;
  endpoint: string | null;
  error_id: Generated<number>;
  error_type_id: number;
  message: string;
  method: string | null;
  stack: string | null;
}

export interface ErrorTypes {
  count_today: Generated<number>;
  error_signature: string;
  error_type_id: Generated<number>;
  first_occurrence: Date;
  last_occurrence: Date;
  total_count: Generated<number>;
}

export interface Events {
  attempts: Generated<number>;
  created_at: Generated<Date>;
  duration_ms: number | null;
  error_message: string | null;
  event_id: string;
  event_name: string;
  initiator_event_id: string | null;
  initiator_event_name: string | null;
  last_attempt_at: Date | null;
  next_attempt_at: Date | null;
  origin_request_id: string;
  origin_request_user_session: Json | null;
  payload: Json;
  payload_version: string | null;
  result_message: string | null;
  status: Generated<"failed" | "pending" | "processing" | "success">;
  updated_at: Generated<Date>;
}

export interface FieldOptions {
  default: Generated<number>;
  fieldname: string;
  fieldoption_id: Generated<number>;
  label: string | null;
  options: Json | null;
  order: Generated<number>;
  tablename: string;
  value: string | null;
}

export interface FieldSettings {
  default: string | null;
  fieldname: string;
  fieldsetting_id: Generated<number>;
  inputtype: string;
  label: string;
  options: Json | null;
  placeholder: string | null;
  tablename: string;
}

export interface Insights {
  address1: Generated<string>;
  address2: string | null;
  attomavm_detail: Json | null;
  attomid: number | null;
  avm_date: Date | null;
  avm_score: number | null;
  avm_value: Decimal | null;
  baths: Decimal | null;
  beds: number | null;
  city: string;
  country: Generated<string>;
  county: string | null;
  created: Generated<Date>;
  floors: number | null;
  insight_id: Generated<number>;
  lat: number | null;
  long: number | null;
  lot: number | null;
  neighborhood: string | null;
  occupancy: string | null;
  owner_name: string | null;
  parking: string | null;
  propertytype: string | null;
  sqft: number | null;
  state: string;
  yearbuilt: number | null;
  zip: string;
}

export interface Integrations {
  active: number | null;
  code: string | null;
  colorhex: string | null;
  integration_id: Generated<number>;
  key1: string | null;
  key2: string | null;
  key3: string | null;
  logo: Buffer | null;
  logo_show: number | null;
  name: string | null;
  url: string | null;
  whitelabel_id: number | null;
}

export interface InvitedInvestors {
  active: Generated<number | null>;
  agent_user_id: number;
  created: Generated<Date>;
  investor_user_id: number;
}

export interface LogEntries {
  created: Generated<Date>;
  created_user_id: number;
  digest_id: string | null;
  level: string;
  log_id: Generated<number>;
  message: string;
  table_id: number | null;
  tablename: string | null;
}

export interface NotificationEvents {
  created: Generated<Date>;
  notification_id: number;
  notificationevent_id: Generated<number>;
  status: string;
}

export interface Notifications {
  active: Generated<number>;
  created: Generated<Date>;
  from_user_id: number;
  isread: Generated<number>;
  message: string;
  msg_id: string | null;
  notification_id: Generated<number>;
  status: string | null;
  subject: string | null;
  to_user_id: number;
  updated: Generated<Date>;
}

export interface NotificationsDash {
  active: Generated<number>;
  created: Generated<Date>;
  from_user_email: string | null;
  from_user_id: number;
  from_user_name: string | null;
  isread: Generated<number>;
  message: string;
  msg_id: string | null;
  notification_id: Generated<number>;
  status: string | null;
  subject: string | null;
  to_user_email: string | null;
  to_user_id: number;
  to_user_name: string | null;
  updated: Generated<Date>;
}

export interface OfferAPIs {
  active: number | null;
  can_offer_check: Generated<number>;
  code: string | null;
  colorhex: string | null;
  key1: string | null;
  key2: string | null;
  key3: string | null;
  logo: Buffer | null;
  logo_show: number | null;
  name: string | null;
  offer_amount_adjustment: Generated<Decimal>;
  offerapi_id: Generated<number>;
  /**
   * 1 = initial, 2 = additional
   */
  submitforoffers: Generated<number>;
  success_fee_pct: Decimal | null;
  url: string | null;
}

export interface Products {
  createdAt: Date;
  data: Json | null;
  price: number;
  product_description: string | null;
  product_id: Generated<number>;
  product_name: string;
  product_type: "none" | "one-time" | "subscription";
  updatedAt: Date;
}

export interface Properties {
  address1: string;
  address2: string | null;
  adjacent: string | null;
  agent_user_id: number;
  avm_date: Date | null;
  avm_score: number | null;
  avm_value: Decimal | null;
  basement: number | null;
  basement_pctfinished: number | null;
  basement_sqft: number | null;
  baths: Decimal | null;
  beds: number | null;
  city: string;
  closed_offer_id: number | null;
  condition: string | null;
  country: Generated<string>;
  county: string | null;
  created: Generated<Date>;
  created_user_id: number;
  customer_brokerage: string | null;
  customer_buyingalso: number | null;
  customer_contacttime: string | null;
  customer_email1: string | null;
  customer_email2: string | null;
  customer_legal_name: string | null;
  customer_name: string | null;
  customer_phone1: string | null;
  customer_phone2: string | null;
  customer_sellreason: string | null;
  customer_timeline: string | null;
  customer_type: Generated<string>;
  customer_user_id: number | null;
  estmortgage: Decimal | null;
  estvalue: Decimal | null;
  exterior_notes: string | null;
  firedamage: number | null;
  firedamage_notes: string | null;
  flooddamage: number | null;
  flooddamage_notes: string | null;
  floodzone: number | null;
  flooring_bathrooms: string | null;
  flooring_bedrooms: string | null;
  flooring_kitchen: string | null;
  flooring_living: string | null;
  flooring_notes: string | null;
  flooring_replaced: string | null;
  floors: number | null;
  foundationdamage: number | null;
  foundationdamage_notes: string | null;
  googlestreetviewaccepted: number | null;
  hoa: number | null;
  hoa_55: number | null;
  /**
   * HOA fee amount in dollars
   */
  hoa_amount: Decimal | null;
  hoa_gated: string | null;
  /**
   * Frequency of HOA fee
   */
  hoa_timing: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  homebuilder: number | null;
  insight_id: number | null;
  intent: Generated<number>;
  is_unlocked: Generated<number | null>;
  kitchen_appliances: string | null;
  kitchen_appliancesnotworking: string | null;
  kitchen_appliancesworking: number | null;
  kitchen_counter: string | null;
  kitchen_features: string | null;
  kitchen_notes: string | null;
  landscape_community: string | null;
  landscape_home: string | null;
  lat: number | null;
  listed: number | null;
  long: number | null;
  lot: number | null;
  neighborhood: string | null;
  nickname: string | null;
  notification_sent: Generated<number>;
  occupancy: string | null;
  parking: string | null;
  pets: number | null;
  pets_notes: string | null;
  photo_url: Generated<string | null>;
  plumbing_septic: number | null;
  plumbing_septic_certified: string | null;
  plumbing_type: string | null;
  pool: string | null;
  property_id: Generated<number>;
  property_token: string | null;
  propertytype: string | null;
  renovation: number | null;
  renovation_notes: string | null;
  roof_age: string | null;
  roof_type: string | null;
  seller_agent_broker: string | null;
  seller_agent_email: string | null;
  seller_agent_name: string | null;
  seller_agent_phone: string | null;
  smoked: number | null;
  solar: number | null;
  solar_leaseamount: Decimal | null;
  solar_leasecompany: string | null;
  solar_type: string | null;
  source: string | null;
  source_pk: string | null;
  sqft: number | null;
  state: string;
  status: Generated<string>;
  status_admin: Generated<string>;
  stormdamage: number | null;
  stormdamage_notes: string | null;
  submitforoffers: Generated<number>;
  success_fee_earned: Decimal | null;
  tenantlease: Decimal | null;
  updated: Generated<Date>;
  updated_user_id: number;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_id: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_term: string | null;
  walls_notes: string | null;
  walls_painted: string | null;
  water_notes: string | null;
  water_type: string | null;
  yearbuilt: number | null;
  zip: string;
}

export interface PropertiesDash {
  address1: string;
  address2: string | null;
  agent_email: string;
  agent_name: string | null;
  agent_phone: string | null;
  agent_user_id: number;
  amount_max: Decimal | null;
  amount_min: Decimal | null;
  avm_date: Date | null;
  avm_score: number | null;
  avm_value: Decimal | null;
  baths: Decimal | null;
  beds: number | null;
  city: string;
  country: Generated<string>;
  created: Generated<Date>;
  created_user_id: number;
  customer_brokerage: string | null;
  customer_buyingalso: number | null;
  customer_email: string | null;
  customer_email1: string | null;
  customer_email2: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_phone1: string | null;
  customer_phone2: string | null;
  customer_sellreason: string | null;
  customer_timeline: string | null;
  customer_type: Generated<string>;
  customer_user_id: number | null;
  estmortgage: Decimal | null;
  estvalue: Decimal | null;
  has_active_showing: Generated<number>;
  is_unlocked: Generated<number | null>;
  lat: number | null;
  listed: number | null;
  long: number | null;
  lot: number | null;
  name_broker: string | null;
  name_team: string | null;
  neighborhood: string | null;
  nickname: string | null;
  offers: Generated<number | null>;
  offers_range: string | null;
  photo_url: Generated<string | null>;
  property_id: Generated<number>;
  property_token: string | null;
  source: string | null;
  source_pk: string | null;
  sqft: number | null;
  state: string;
  status: Generated<string>;
  status_admin: Generated<string>;
  status_admin_label: string | null;
  status_label: string | null;
  team_id: number | null;
  teamname: string | null;
  updated: Generated<Date>;
  whitelabel_name: string;
  zip: string;
}

export interface PropertiesJoined {
  address1: string;
  address2: string | null;
  adjacent: string | null;
  agent_email: string | null;
  agent_name: string | null;
  agent_name_broker: string | null;
  agent_phone: string | null;
  agent_user_id: number;
  avm_date: Date | null;
  avm_score: number | null;
  avm_value: Decimal | null;
  basement: number | null;
  basement_pctfinished: number | null;
  basement_sqft: number | null;
  baths: Decimal | null;
  beds: number | null;
  city: string;
  country: Generated<string>;
  county: string | null;
  created: Generated<Date>;
  created_user_id: number;
  customer_email1: string | null;
  customer_email2: string | null;
  customer_name: string | null;
  customer_name2: string | null;
  customer_phone1: string | null;
  customer_phone2: string | null;
  customer_sellreason: string | null;
  customer_timeline: string | null;
  customer_user_id: number | null;
  estmortgage: Decimal | null;
  estvalue: Decimal | null;
  exterior_notes: string | null;
  firedamage: number | null;
  firedamage_notes: string | null;
  flooddamage: number | null;
  flooddamage_notes: string | null;
  floodzone: number | null;
  flooring_bathrooms: string | null;
  flooring_bedrooms: string | null;
  flooring_kitchen: string | null;
  flooring_living: string | null;
  flooring_notes: string | null;
  flooring_replaced: string | null;
  floors: number | null;
  foundationdamage: number | null;
  foundationdamage_notes: string | null;
  googlestreetviewaccepted: number | null;
  hoa: number | null;
  hoa_55: number | null;
  hoa_gated: string | null;
  homebuilder: number | null;
  insight_id: number | null;
  kitchen_appliances: string | null;
  kitchen_appliancesnotworking: string | null;
  kitchen_appliancesworking: number | null;
  kitchen_counter: string | null;
  kitchen_features: string | null;
  kitchen_notes: string | null;
  landscape_community: string | null;
  landscape_home: string | null;
  lat: number | null;
  listed: number | null;
  long: number | null;
  lot: number | null;
  neighborhood: string | null;
  nickname: string | null;
  occupancy: string | null;
  parking: string | null;
  pets: number | null;
  pets_notes: string | null;
  plumbing_septic: number | null;
  plumbing_septic_certified: string | null;
  plumbing_type: string | null;
  pool: string | null;
  property_id: Generated<number>;
  property_token: string | null;
  propertytype: string | null;
  renovation: number | null;
  renovation_notes: string | null;
  roof_age: string | null;
  roof_type: string | null;
  smoked: number | null;
  solar: number | null;
  solar_leaseamount: Decimal | null;
  solar_leasecompany: string | null;
  solar_type: string | null;
  source: string | null;
  source_pk: string | null;
  sqft: number | null;
  state: string;
  status: Generated<string>;
  status_admin: Generated<string>;
  stormdamage: number | null;
  stormdamage_notes: string | null;
  submitforoffers: Generated<number>;
  tenantlease: Decimal | null;
  updated: Generated<Date>;
  updated_user_id: number;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_id: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_term: string | null;
  walls_notes: string | null;
  walls_painted: string | null;
  water_notes: string | null;
  water_type: string | null;
  yearbuilt: number | null;
  zip: string;
}

export interface PropertiesMetadata {
  city: string;
  photo_url: string | null;
  property_id: Generated<number>;
  property_token: string | null;
  state: string;
  zip: string;
}

export interface PropertiesQuick {
  address1: string;
  agent_name: string | null;
  agent_user_id: number;
  city: string;
  created: Generated<Date>;
  created_user_id: number;
  customer_name: string | null;
  customer_user_id: number | null;
  photo_url: string | null;
  property_id: Generated<number>;
  property_token: string | null;
  state: string;
  status: Generated<string>;
  status_admin: Generated<string>;
  updated: Generated<Date>;
  zip: string;
}

export interface PropertiesSubmitForOffers {
  attempts: Generated<number>;
  property_id: number;
  queue_created: Date | null;
  scheduled: Date | null;
  submitforoffers: number;
}

export interface PropertyBuyBoxes {
  buybox_id: number;
  property_id: number;
  updated: Generated<Date>;
}

export interface PropertyBuyBoxesBuyers {
  buyer_count: Generated<number>;
  property_created: Generated<Date | null>;
  property_id: number;
}

export interface PropertyBuyBoxesDash {
  address1: string | null;
  address2: string | null;
  agent_email: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_user_id: number | null;
  amount_max: Decimal | null;
  amount_min: Decimal | null;
  baths: Decimal | null;
  beds: number | null;
  buybox_active: Generated<number | null>;
  buybox_autooffer: Generated<number | null>;
  buybox_autooffer_avm_pct: Decimal | null;
  buybox_autooffer_buyer_notes: string | null;
  buybox_autooffer_category: string | null;
  buybox_autooffer_data: string | null;
  buybox_autooffer_expiration_days: Generated<number | null>;
  buybox_autooffer_max: Decimal | null;
  buybox_autooffer_min: Decimal | null;
  buybox_autooffer_nickname: string | null;
  buybox_created_user_id: number | null;
  buybox_created_user_name: string | null;
  buybox_customer_user_id: number | null;
  buybox_customer_user_name: string | null;
  buybox_id: number;
  buybox_nickname: string | null;
  city: string | null;
  country: Generated<string | null>;
  created: Generated<Date | null>;
  created_user_id: number | null;
  customer_email: string | null;
  customer_email1: string | null;
  customer_email2: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_phone1: string | null;
  customer_phone2: string | null;
  customer_sellreason: string | null;
  customer_timeline: string | null;
  customer_user_id: number | null;
  lat: number | null;
  long: number | null;
  lot: number | null;
  neighborhood: string | null;
  nickname: string | null;
  offers: Generated<number | null>;
  offers_range: string | null;
  photo_url: Generated<string | null>;
  property_id: Generated<number | null>;
  property_token: string | null;
  source: string | null;
  source_pk: string | null;
  sqft: number | null;
  state: string | null;
  status: Generated<string | null>;
  status_admin: Generated<string | null>;
  status_admin_label: string | null;
  status_label: string | null;
  team_id: number | null;
  teamname: string | null;
  updated: Generated<Date | null>;
  updated_property_buybox: Generated<Date>;
  zip: string | null;
}

export interface PropertyFiles {
  category: string | null;
  created: Generated<Date>;
  created_user_id: number;
  file_id: Generated<number>;
  file_notes: string | null;
  file_token: string;
  file_url: string;
  mime_type: string | null;
  original_filename: string | null;
  primary: Generated<number>;
  property_id: number;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface PropertyMessages {
  created: Generated<Date>;
  created_user_id: number;
  message: string;
  message_id: Generated<number>;
  offer_id: number | null;
  property_id: number;
  to_user_id: number | null;
}

export interface PropertyMessagesDash {
  created: Generated<Date>;
  created_user_id: number;
  created_user_name: string | null;
  message: string;
  message_id: Generated<number>;
  offer_id: number | null;
  property_id: number;
  to_user_id: number | null;
  to_user_name: string | null;
}

export interface PropertyOfferAPIs {
  created: Generated<Date>;
  data: string | null;
  offerapi_id: number;
  offerapi_pk: string | null;
  property_id: number;
  propertyofferapi_id: Generated<number>;
}

export interface PropertyOfferAPIsDash {
  can_offer_check: Generated<number | null>;
  created: Generated<Date>;
  data: string | null;
  offerapi_id: number;
  offerapi_name: string | null;
  offerapi_pk: string | null;
  property_id: number;
  propertyofferapi_id: Generated<number>;
}

export interface PropertyOffers {
  amount: Decimal | null;
  amount_initial: Decimal | null;
  amount_net: Decimal | null;
  amount_net_buyer: Decimal | null;
  category: Generated<string>;
  commission: Decimal | null;
  counter_amount: Decimal | null;
  counter_created: Date | null;
  created: Generated<Date>;
  created_user_id: number;
  customer_user_id: number | null;
  data: string | null;
  data_bk: string | null;
  expiration: Date | null;
  finalize_message: string | null;
  /**
   * 1 = final offer, 0 = not final
   */
  is_final_offer: Generated<number>;
  lender_user_id: number | null;
  nickname: string;
  notes_buyer: string | null;
  notes_seller: string | null;
  offer_id: Generated<number>;
  offerapi_id: number | null;
  offerapi_pk: string | null;
  offerapi_pk2: string | null;
  prequal_userfile_id: number | null;
  property_id: number;
  requested_coe: Date | null;
  source: string | null;
  source_sub: string | null;
  status: Generated<string>;
  updated: Generated<Date>;
  updated_user_id: number;
}

export interface PropertyOffersDash {
  address1: string | null;
  address2: string | null;
  agent_user_id: number | null;
  amount: Decimal | null;
  amount_net: Decimal | null;
  category: Generated<string>;
  category_label: string | null;
  city: string | null;
  commission: Decimal | null;
  country: Generated<string | null>;
  created: Generated<Date>;
  created_user_id: number;
  created_user_name: string | null;
  customer_name: string | null;
  customer_user_id: number | null;
  data: string | null;
  expiration: Date | null;
  lender_user_id: number | null;
  nickname: string;
  notes_buyer: string | null;
  notes_seller: string | null;
  offer_id: Generated<number>;
  offerapi_id: number | null;
  offerapi_pk: string | null;
  photo_url: Generated<string | null>;
  prequal_url: string | null;
  property_created_user_id: number | null;
  property_customer_user_id: number | null;
  property_id: number;
  property_token: string | null;
  source: string | null;
  source_sub: string | null;
  state: string | null;
  status: Generated<string>;
  status_label: string | null;
  updated: Generated<Date>;
  updated_user_id: number;
  zip: string | null;
}

export interface PropertyOffersReportDashboard {
  address1: string | null;
  address2: string | null;
  agent_user_id: number | null;
  amount: Decimal | null;
  amount_pct_estvalue: Decimal | null;
  avm_value: Decimal | null;
  category: Generated<string>;
  city: string | null;
  country: Generated<string | null>;
  created: Generated<Date>;
  created_user_id: number;
  created_user_name: string | null;
  created_user_role: Generated<string | null>;
  created_user_role_display: string | null;
  created_user_type: string | null;
  estvalue: Decimal | null;
  expiration: Date | null;
  /**
   * 1 = final offer, 0 = not final
   */
  is_final_offer: Generated<number>;
  latest_status_change_date: Generated<Date>;
  lender_user_id: number | null;
  offer_id: Generated<number>;
  offerapi_id: number | null;
  offerapi_name: string | null;
  property_id: number;
  state: string | null;
  status: Generated<string>;
  status_days: number | null;
  status_display: Generated<string>;
  status_display_grouped: Generated<string>;
  zip: string | null;
}

export interface PropertyQueue {
  attempts: Generated<number>;
  completed: Date | null;
  created: Generated<Date>;
  property_id: number;
  scheduled: Date | null;
  submitforoffers: number;
}

export interface PropertyRules {
  property_id: number;
  rule_id: number;
}

export interface PropertyRulesQueue {
  completed: Date | null;
  created: Generated<Date>;
  property_id: number;
}

export interface PropertyUsers {
  created: Generated<Date>;
  nickname: string | null;
  notified: Date | null;
  property_id: number;
  rank: number | null;
  status: Generated<"DECLINED" | "NEW" | "NOTIFIED" | "VIEWED">;
  user_id: number;
  viewlevel: Generated<number>;
}

export interface PropertyUsersDash {
  baths: Decimal | null;
  beds: number | null;
  city: string | null;
  country: Generated<string | null>;
  created: Generated<Date | null>;
  myoffers: number | null;
  nickname: string | null;
  notified: Date | null;
  photo_url: Generated<string | null>;
  property_id: number | null;
  property_token: string | null;
  rank: number | null;
  state: string | null;
  status: Generated<"DECLINED" | "NEW" | "NOTIFIED" | "VIEWED" | null>;
  user_active: Generated<number | null>;
  user_email: string | null;
  user_id: number | null;
  user_name: string | null;
  user_notifications_email: Generated<number | null>;
  viewlevel: Generated<number | null>;
  zip: string | null;
}

export interface Roles {
  alerts_create: Generated<number>;
  alerts_read_all: Generated<number>;
  alerts_update: Generated<number>;
  buyboxes_create: Generated<number>;
  buyboxes_delete: Generated<number>;
  buyboxes_read: Generated<number>;
  buyboxes_read_all: Generated<number>;
  buyboxes_update: Generated<number>;
  buyboxes_update_all: Generated<number>;
  offers_create: Generated<number>;
  offers_delete: Generated<number>;
  offers_delete_all: Generated<number>;
  offers_read: Generated<number>;
  offers_read_all: Generated<number>;
  offers_update: Generated<number>;
  offers_update_all: Generated<number>;
  payments_create: Generated<number>;
  payments_delete: Generated<number>;
  payments_delete_all: Generated<number>;
  payments_read: Generated<number>;
  payments_read_all: Generated<number>;
  properties_assign: Generated<number>;
  properties_create: Generated<number>;
  properties_delete: Generated<number>;
  properties_delete_all: Generated<number>;
  properties_read: Generated<number>;
  properties_read_all: Generated<number>;
  properties_read_all_investor: Generated<number>;
  properties_read_investor: Generated<number>;
  properties_unlock: Generated<number>;
  properties_update: Generated<number>;
  properties_update_all: Generated<number>;
  reports_read: Generated<number>;
  role: string;
  rolename: string | null;
  settings: Generated<number>;
  teams_create: Generated<number>;
  teams_delete: Generated<number>;
  teams_read: Generated<number>;
  teams_read_all: Generated<number>;
  teams_update: Generated<number>;
  users_create: Generated<number>;
  users_create_all: Generated<number>;
  users_delete: Generated<number>;
  users_delete_all: Generated<number>;
  users_read: Generated<number>;
  users_read_all: Generated<number>;
  users_update: Generated<number>;
  users_update_all: Generated<number>;
}

export interface Rules {
  created: Generated<Date>;
  rule: Json;
  rule_id: Generated<number>;
  ruletype: string;
}

export interface ShowingFeedback {
  feedback: string | null;
  feedback_id: Generated<number>;
  showing_id: number;
  submitted_at: Generated<Date>;
  /**
   * 1 = Yes, 0 = No
   */
  was_open: number;
}

export interface ShowingRSVPs {
  responded_at: Generated<Date>;
  rsvp_id: Generated<number>;
  showing_id: number;
  /**
   * User who RSVPed
   */
  user_id: number;
}

export interface Showings {
  canceled: Generated<number>;
  canceled_at: Date | null;
  created: Generated<Date>;
  /**
   * User (agent) who created the showing
   */
  created_user_id: number;
  end_time: string;
  /**
   * Set to 1 when a “No” feedback is received
   */
  flagged_not_open: Generated<number>;
  instructions: string | null;
  property_id: number;
  show_date: Date;
  showing_id: Generated<number>;
  start_time: string;
  updated: Generated<Date>;
}

export interface SinglePropertyOffersDash {
  address1: string | null;
  address2: string | null;
  agent_user_id: number | null;
  amount: Decimal | null;
  amount_initial: Decimal | null;
  amount_net: Decimal | null;
  amount_net_buyer: Decimal | null;
  category: Generated<string>;
  category_label: string | null;
  city: string | null;
  commission: Decimal | null;
  counter_amount: Decimal | null;
  counter_created: Date | null;
  country: Generated<string | null>;
  created: Generated<Date>;
  created_user_id: number;
  created_user_name: string | null;
  customer_name: string | null;
  customer_user_id: number | null;
  customer_user_name: string | null;
  data: string | null;
  data_bk: string | null;
  expiration: Date | null;
  /**
   * 1 = final offer, 0 = not final
   */
  is_final_offer: Generated<number>;
  lender_user_id: number | null;
  nickname: string;
  notes_buyer: string | null;
  notes_seller: string | null;
  offer_id: Generated<number>;
  offerapi_id: number | null;
  offerapi_pk: string | null;
  photo_url: Generated<string | null>;
  prequal_url: string | null;
  prequal_userfile_id: number | null;
  property_created_user_id: number | null;
  property_customer_user_id: number | null;
  property_id: number;
  property_token: string | null;
  source: string | null;
  source_sub: string | null;
  state: string | null;
  status: Generated<string>;
  status_label: string | null;
  updated: Generated<Date>;
  updated_user_id: number;
  updated_user_name: string | null;
  zip: string | null;
}

export interface Subscriptions {
  amount: number;
  cancel_on_renewal: Generated<number | null>;
  createdAt: Date;
  data: Json | null;
  duration: "daily" | "monthly" | "weekly" | "yearly";
  meta: string | null;
  /**
   * The date and time when the next renewal attempt should occur after a failed payment
   */
  next_renewal_attempt: Date | null;
  product_id: number | null;
  renewal_date: Date;
  status: string | null;
  subscription_id: Generated<number>;
  subscription_name: string;
  suspension_date: Date | null;
  updatedAt: Date;
  user_id: number;
}

export interface SubscriptionsDash {
  amount: number;
  cancel_on_renewal: Generated<number | null>;
  duration: "daily" | "monthly" | "weekly" | "yearly";
  email: string;
  meta: string | null;
  name: string | null;
  /**
   * The date and time when the next renewal attempt should occur after a failed payment
   */
  next_renewal_attempt: Date | null;
  price: number | null;
  product_created_at: Date | null;
  product_data: Json | null;
  product_description: string | null;
  product_id: number | null;
  product_name: string | null;
  product_type: "none" | "one-time" | "subscription" | null;
  product_updated_at: Date | null;
  renewal_date: Date;
  role: Generated<string>;
  status: string | null;
  subscription_created_at: Date;
  subscription_data: Json | null;
  subscription_id: Generated<number>;
  subscription_name: string;
  subscription_updated_at: Date;
  suspension_date: Date | null;
  user_created_at: Generated<Date>;
  user_id: number;
}

export interface Teams {
  active: Generated<number>;
  address1: string | null;
  address2: string | null;
  city: string | null;
  country: string | null;
  created: Generated<Date>;
  max_users: Generated<number>;
  media_broker: Buffer | null;
  media_teamlogo: Buffer | null;
  state: string | null;
  team_id: Generated<number>;
  teamname: string;
  whitelabel_id: Generated<number>;
  zip: string | null;
}

export interface TeamsDash {
  active: Generated<number | null>;
  active_users: number | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  country: string | null;
  created: Generated<Date | null>;
  max_users: Generated<number | null>;
  media_broker: Buffer | null;
  state: string | null;
  team_id: Generated<number | null>;
  teamname: string | null;
  whitelabel_id: Generated<number | null>;
  whitelabel_name: string | null;
  zip: string | null;
}

export interface Transactions {
  amount: number | null;
  createdAt: Date;
  data: string | null;
  memo: string | null;
  product_id: number | null;
  square_transaction_id: string | null;
  status: string | null;
  transaction_id: Generated<number>;
  type: string;
  updatedAt: Date;
  user_id: number | null;
}

export interface TransactionsDash {
  amount: number | null;
  memo: string | null;
  price: number | null;
  product_id: number | null;
  product_name: string | null;
  product_type: "none" | "one-time" | "subscription" | null;
  square_transaction_id: string | null;
  status: string | null;
  transaction_createdAt: Date;
  transaction_data: string | null;
  transaction_id: Generated<number>;
  transaction_updatedAt: Date;
  type: string;
  user_email: string | null;
  user_id: number | null;
  user_name: string | null;
  user_phone: string | null;
}

export interface UserAlerts {
  alert_id: number;
  created_at: Generated<Date | null>;
  status: Generated<"read" | "unread">;
  updated_at: Generated<Date | null>;
  user_id: number;
}

export interface UserCards {
  card_brand: string;
  card_id: string;
  cardholder_name: string | null;
  createdAt: Date;
  exp_month: string;
  exp_year: string;
  id: Generated<number>;
  last_4: string;
  square_customer_id: string;
  updatedAt: Date;
  user_id: number | null;
}

export interface UserFiles {
  category: string | null;
  created: Generated<Date>;
  created_user_id: number;
  file_token: string;
  file_url: string;
  mime_type: string | null;
  nickname: string;
  original_filename: string | null;
  updated: Generated<Date>;
  updated_user_id: number;
  user_id: number;
  userfile_id: Generated<number>;
}

export interface UserIntegrations {
  created: Generated<Date>;
  data: string | null;
  integration_id: number;
  integration_pk: string;
  user_id: number;
  userintegration_id: Generated<number>;
}

export interface Users {
  active: Generated<number>;
  address1: string | null;
  address2: string | null;
  agent_user_id: number | null;
  api_token: string | null;
  city: string | null;
  country: string | null;
  created: Generated<Date>;
  email: string;
  email2: string | null;
  integration_id: number | null;
  integration_pk: string | null;
  investor_view_address: Generated<number>;
  is_premium: Generated<number | null>;
  lastlogin: Date | null;
  lender_user_id: number | null;
  location: string | null;
  /**
   * Incremented on each magic-link sign-in to ensure a link cannot be reused
   */
  magic_link_sign_in_count: Generated<number>;
  max_property_value: number | null;
  media_broker: Buffer | null;
  media_headshot: Buffer | null;
  name: string | null;
  name_broker: string | null;
  name_team: string | null;
  notifications_email: Generated<number>;
  notifications_email_alloffers_accept: Generated<number>;
  notifications_email_allproperties: Generated<number>;
  notifications_sms: Generated<number>;
  password: string;
  phone: string | null;
  reset_created: Date | null;
  reset_token: string | null;
  role: Generated<string>;
  slug: string | null;
  state: string | null;
  success_fee_pct: Decimal | null;
  team_id: number | null;
  user_id: Generated<number>;
  whitelabel_id: Generated<number>;
  zip: string | null;
}

export interface UsersDash {
  active: Generated<number | null>;
  address1: string | null;
  address2: string | null;
  agent_email: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_user_id: number | null;
  api_token: string | null;
  city: string | null;
  country: string | null;
  created: Generated<Date | null>;
  email: string | null;
  email2: string | null;
  integration_id: number | null;
  integration_pk: string | null;
  investor_view_address: Generated<number | null>;
  is_premium: Generated<number | null>;
  lender_email: string | null;
  lender_name: string | null;
  lender_phone: string | null;
  lender_user_id: number | null;
  max_property_value: number | null;
  media_broker: Buffer | null;
  media_headshot: Buffer | null;
  name: string | null;
  name_broker: string | null;
  name_team: string | null;
  notifications_email: Generated<number | null>;
  notifications_email_alloffers_accept: Generated<number | null>;
  notifications_email_allproperties: Generated<number | null>;
  notifications_sms: Generated<number | null>;
  password: string | null;
  phone: string | null;
  properties_30days: number | null;
  reset_created: Date | null;
  reset_token: string | null;
  role: Generated<string | null>;
  slug: string | null;
  state: string | null;
  success_fee_pct: Decimal | null;
  team_id: number | null;
  teamname: string | null;
  user_id: Generated<number | null>;
  whitelabel_code: string | null;
  whitelabel_id: Generated<number | null>;
  whitelabel_name: string | null;
  zip: string | null;
}

export interface UserSettings {
  created: Generated<Date>;
  field: string;
  user_id: number;
  value: string;
}

export interface UsersReportDashboard {
  active: Generated<number>;
  agent_user_id: number | null;
  created: Generated<Date>;
  email: string;
  is_premium: Generated<number | null>;
  is_primary: Generated<number>;
  lastlogin: Date | null;
  lender_user_id: number | null;
  name: string | null;
  name_broker: string | null;
  role: Generated<string>;
  role_display: Generated<string>;
  team_id: number | null;
  team_name: string | null;
  user_id: Generated<number>;
  whitelabel_id: Generated<number>;
  whitelabel_name: string | null;
}

export interface UsersSelf {
  active: Generated<number>;
  address1: string | null;
  address2: string | null;
  agent_email: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_user_id: number | null;
  api_token: string | null;
  card_id: string | null;
  city: string | null;
  country: string | null;
  created: Generated<Date>;
  email: string;
  integration_id: number | null;
  integration_pk: string | null;
  investor_view_address: Generated<number>;
  is_premium: Generated<number | null>;
  lender_user_id: number | null;
  lender_user_name: string | null;
  lender_user_phone: string | null;
  max_property_value: number | null;
  media_broker: Buffer | null;
  media_headshot: Buffer | null;
  name: string | null;
  name_broker: string | null;
  name_team: string | null;
  notifications_email: Generated<number>;
  notifications_email_alloffers_accept: Generated<number>;
  notifications_email_allproperties: Generated<number>;
  notifications_sms: Generated<number>;
  password: string;
  phone: string | null;
  reset_created: Date | null;
  reset_token: string | null;
  role: Generated<string>;
  slug: string | null;
  state: string | null;
  team_id: number | null;
  teamname: string | null;
  user_id: Generated<number>;
  whitelabel_code: string | null;
  whitelabel_id: Generated<number>;
  whitelabel_name: string | null;
  zip: string | null;
}

export interface Webhooks {
  active: Generated<number | null>;
  created: Generated<Date>;
  endpoint: "NOTIFICATIONS" | "PROPERTIES" | "PROPERTY_MESSAGES" | "PROPERTY_OFFERS" | "PROPERTY_USERS";
  target_url: string;
  triggerpoint: "DELETE" | "INSERT" | "UPDATE";
  updated: Generated<Date>;
  user_id: number;
  webhook_id: Generated<number>;
}

export interface Websites {
  about: string | null;
  active: Generated<number | null>;
  background_url: string | null;
  code_conversion: string | null;
  code_tracking: string | null;
  color_scheme: Generated<"B&W" | "BLUE" | "HIGHESTPRICE" | "RED" | null>;
  created: Generated<Date>;
  domain: string | null;
  domain_verified: Generated<number | null>;
  email: string | null;
  footer: string | null;
  logo_url: string | null;
  phone: string | null;
  slug: string;
  testimonials: Json | null;
  title: string;
  unbranded: Generated<number>;
  user_id: number;
  website_id: Generated<number>;
}

export interface WebsitesDash {
  about: string | null;
  active: Generated<number | null>;
  background_url: string | null;
  code_conversion: string | null;
  code_tracking: string | null;
  color_scheme: Generated<"B&W" | "BLUE" | "HIGHESTPRICE" | "RED" | null>;
  created: Generated<Date>;
  domain: string | null;
  domain_verified: Generated<number | null>;
  email: string | null;
  footer: string | null;
  is_premium: Generated<number | null>;
  logo_url: string | null;
  media_broker: Buffer | null;
  phone: string | null;
  slug: string;
  testimonials: Json | null;
  title: string;
  unbranded: Generated<number>;
  user_active: Generated<number | null>;
  user_email: string | null;
  user_id: number;
  user_name: string | null;
  user_phone: string | null;
  user_slug: string | null;
  website_id: Generated<number>;
}

export interface Whitelabels {
  code: string;
  name: string;
  whitelabel_id: Generated<number>;
}

export interface DB {
  AgentBox_Rules: AgentBoxRules;
  AgentBox_Rules_Dash: AgentBoxRulesDash;
  AgentBox_Users: AgentBoxUsers;
  AgentBoxes: AgentBoxes;
  AgentBoxes_Dash: AgentBoxesDash;
  Alert_Roles: AlertRoles;
  Alert_Whitelabels: AlertWhitelabels;
  Alerts: Alerts;
  AuditFields: AuditFields;
  Audits: Audits;
  BuyBox_Rules: BuyBoxRules;
  BuyBox_Rules_Dash: BuyBoxRulesDash;
  BuyBoxes: BuyBoxes;
  BuyBoxes_Dash: BuyBoxesDash;
  EmittedEvents: EmittedEvents;
  ErrorInstances: ErrorInstances;
  ErrorTypes: ErrorTypes;
  Events: Events;
  FieldOptions: FieldOptions;
  FieldSettings: FieldSettings;
  Insights: Insights;
  Integrations: Integrations;
  InvitedInvestors: InvitedInvestors;
  LogEntries: LogEntries;
  Notification_Events: NotificationEvents;
  Notifications: Notifications;
  Notifications_Dash: NotificationsDash;
  OfferAPIs: OfferAPIs;
  Products: Products;
  Properties: Properties;
  Properties_Dash: PropertiesDash;
  Properties_Joined: PropertiesJoined;
  Properties_Metadata: PropertiesMetadata;
  Properties_Quick: PropertiesQuick;
  Properties_SubmitForOffers: PropertiesSubmitForOffers;
  Property_BuyBoxes: PropertyBuyBoxes;
  Property_BuyBoxes_Buyers: PropertyBuyBoxesBuyers;
  Property_BuyBoxes_Dash: PropertyBuyBoxesDash;
  Property_Files: PropertyFiles;
  Property_Messages: PropertyMessages;
  Property_Messages_Dash: PropertyMessagesDash;
  Property_OfferAPIs: PropertyOfferAPIs;
  Property_OfferAPIs_Dash: PropertyOfferAPIsDash;
  Property_Offers: PropertyOffers;
  Property_Offers_Dash: PropertyOffersDash;
  Property_Offers_Report_Dashboard: PropertyOffersReportDashboard;
  Property_Queue: PropertyQueue;
  Property_Rules: PropertyRules;
  Property_Rules_Queue: PropertyRulesQueue;
  Property_Users: PropertyUsers;
  Property_Users_Dash: PropertyUsersDash;
  Roles: Roles;
  Rules: Rules;
  Showing_Feedback: ShowingFeedback;
  Showing_RSVPs: ShowingRSVPs;
  Showings: Showings;
  Single_Property_Offers_Dash: SinglePropertyOffersDash;
  Subscriptions: Subscriptions;
  Subscriptions_Dash: SubscriptionsDash;
  Teams: Teams;
  Teams_Dash: TeamsDash;
  Transactions: Transactions;
  Transactions_Dash: TransactionsDash;
  User_Alerts: UserAlerts;
  User_Files: UserFiles;
  User_Integrations: UserIntegrations;
  User_Settings: UserSettings;
  UserCards: UserCards;
  Users: Users;
  Users_Dash: UsersDash;
  Users_Report_Dashboard: UsersReportDashboard;
  Users_Self: UsersSelf;
  Webhooks: Webhooks;
  Websites: Websites;
  Websites_Dash: WebsitesDash;
  Whitelabels: Whitelabels;
}
