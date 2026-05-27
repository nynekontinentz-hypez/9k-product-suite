module.exports = {
  up: `
    ALTER TABLE clients ADD COLUMN industry TEXT;
    ALTER TABLE clients ADD COLUMN primary_contact_role TEXT;
    ALTER TABLE clients ADD COLUMN city TEXT;
    ALTER TABLE clients ADD COLUMN website TEXT;
    ALTER TABLE clients ADD COLUMN address TEXT;
    ALTER TABLE clients ADD COLUMN business_age TEXT;
    ALTER TABLE clients ADD COLUMN os_windows INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN os_mac INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN os_chrome INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN os_mixed INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_google_workspace INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_cloud_backup INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_antivirus INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_firewall INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_vpn INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_remote_work INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN uses_onsite_server INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN pain_point TEXT;
    ALTER TABLE clients ADD COLUMN interest_managed_it INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_cybersecurity INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_cloud INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_m365 INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_backup INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_compliance INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_vcio INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN interest_training INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN budget_range TEXT;
    ALTER TABLE clients ADD COLUMN timeline TEXT;
    ALTER TABLE clients ADD COLUMN compliance_hipaa INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN compliance_pci INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN compliance_soc2 INTEGER DEFAULT 0;
    ALTER TABLE clients ADD COLUMN referral_source TEXT;
    ALTER TABLE clients ADD COLUMN previous_msp_experience TEXT;
  `
};
