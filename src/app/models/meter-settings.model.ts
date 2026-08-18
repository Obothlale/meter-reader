export interface MeterSettings {
  accountNumber: string;
  portion: string;
  accountHolder: string;
  contactNumber: string;
  homeAddress: string;
  submitterEmail: string;
  recipientEmail: string;
  bccList: string;
}

export const DEFAULT_METER_SETTINGS: MeterSettings = {
  accountNumber: '',
  portion: '',
  accountHolder: '',
  contactNumber: '',
  homeAddress: '',
  submitterEmail: '',
  recipientEmail: 'meterrecords@tshwane.gov.za',
  bccList: '',
};
