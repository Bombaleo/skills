/* =====================================================================
   Flex Work API · spec extension (part 5 — re-audit close-out)
   ---------------------------------------------------------------------
   Implements every remaining gap identified in Flex Work API Audit v2.0.

   Honorable mentions:
     A-11a mTLS certificates on API keys
     A-11b API-key IP allowlist
     A-11c Webhook payload encryption (envelope encryption)
     A-11d Resumable file uploads (tus.io 1.0)
     A-11f Right-to-erasure batch (GDPR / CCPA)
     A-11g OpenAPI schema-diff endpoint
   New gaps (this pass):
     N-01 Tax-form generation (1099 / W-2 / T4)
     N-02 Banking & direct deposit
     N-03 Geofenced clock-in / clock-out

   A-11e NDJSON streaming ships as an info page in the renderer
   (cross-cutting Accept-header contract, no new endpoints).

   Total: +27 endpoints across 6 new tags.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }
  function ensureTag(t) { if (!spec.tags.find(function (x) { return x.id === t.id; })) spec.tags.push(t); }

  /* =========== TAGS ================================================ */
  ensureTag({ id: "mtls", name: "mTLS",
    description: "Mutual-TLS binding for high-security API keys. Federal customers and most defense contractors require mTLS in addition to bearer tokens; the certificate authenticates the calling org, the bearer authenticates the workload." });
  ensureTag({ id: "ip-allowlist", name: "IP allowlist",
    description: "Per-API-key CIDR allowlists. Required by most SOC2 controls and assumed by every federal accreditation. Requests from outside the list return 403 with a stable error code so audit logs detect attempted exfiltration." });
  ensureTag({ id: "webhook-encryption", name: "Webhook encryption",
    description: "Envelope-encrypted webhook payloads with rotating key ids. HMAC signing protects integrity; encryption closes the residual confidentiality gap that protects worker PII when receivers are misconfigured." });
  ensureTag({ id: "privacy", name: "Privacy & erasure",
    description: "GDPR / CCPA right-to-erasure orchestration. Codifies DSAR / SAR handling across every backing store — DB, files, audit log, search index — with a hard 30-day SLA." });
  ensureTag({ id: "tax-forms", name: "Tax forms",
    description: "Year-end tax-form generation and delivery — 1099-NEC for contractors, W-2 for employees, T4 for Canadian workers. Forms are versioned per tax year and consent-tracked per worker." });
  ensureTag({ id: "banking", name: "Banking & direct deposit",
    description: "Worker bank-account management for direct-deposit payroll. Account numbers are write-only — once stored, only the last four digits are returned. Plaid Auth handoff is supported as the primary entry path." });
  ensureTag({ id: "clocking", name: "Clock-in / clock-out",
    description: "Geofenced punch-in / punch-out for worker-mobile. Each punch is validated against the location's geofence and tagged with the validation result so attendance KPIs can weight in-fence vs out-of-fence punches." });

  /* =========== Add tags to groups ================================= */
  function appendToGroup(groupId, tagIds) {
    var g = (spec.groups || []).find(function (x) { return x.id === groupId; });
    if (!g) return;
    tagIds.forEach(function (t) { if (g.tags.indexOf(t) < 0) g.tags.push(t); });
  }
  appendToGroup("developers", ["mtls", "ip-allowlist", "webhook-encryption"]);
  appendToGroup("identity",   ["privacy"]);
  appendToGroup("money",      ["tax-forms", "banking"]);
  appendToGroup("operations", ["clocking"]);

  /* =========== Schemas ============================================ */
  Object.assign(spec.schemas, {
    ClientCertificate: {
      description: "An X.509 client certificate bound to an API key. Establishes the mTLS principal alongside the bearer token.",
      fields: [
        { name: "id",          type: "string<ulid>", required: true,  desc: "Certificate identifier." },
        { name: "apiKeyId",    type: "string<ulid>", required: true,  desc: "Bound API key." },
        { name: "subject",     type: "string",       required: true,  desc: "Certificate subject DN." },
        { name: "issuer",      type: "string",       required: true,  desc: "Issuer DN." },
        { name: "fingerprint", type: "string",       required: true,  desc: "SHA-256 fingerprint, colon-separated hex." },
        { name: "notBefore",   type: "string<datetime>", required: true, desc: "Validity start." },
        { name: "notAfter",    type: "string<datetime>", required: true, desc: "Validity end." },
        { name: "status",      type: "enum",         required: true,  desc: "Lifecycle.", enum: ["active", "expired", "revoked"] }
      ]
    },
    IpAllowlist: {
      description: "Per-API-key CIDR allowlist. Empty means no restriction.",
      fields: [
        { name: "apiKeyId", type: "string<ulid>",   required: true, desc: "Bound API key." },
        { name: "cidrs",    type: "Array<string>",  required: true, desc: "IPv4 or IPv6 CIDR ranges. Empty array disables the allowlist." }
      ]
    },
    ErasureRequest: {
      description: "A right-to-erasure request orchestrating redaction across every backing store.",
      fields: [
        { name: "id",          type: "string<ulid>", required: true,  desc: "Request identifier." },
        { name: "subjectType", type: "enum",         required: true,  desc: "Subject of the erasure.", enum: ["worker", "candidate", "user"] },
        { name: "subjectId",   type: "string<ulid>", required: true,  desc: "Subject identifier." },
        { name: "requestedBy", type: "string<ulid>", required: true,  desc: "User who submitted the request." },
        { name: "requestedAt", type: "string<datetime>", required: true, desc: "Submission timestamp." },
        { name: "dueBy",       type: "string<datetime>", required: true, desc: "GDPR hard SLA — 30 days from request." },
        { name: "status",      type: "enum",         required: true,  desc: "Lifecycle.", enum: ["received", "in_review", "approved", "running", "completed", "rejected"] },
        { name: "completedAt", type: "string<datetime>", required: false, desc: "When erasure finished. Null until status=completed." },
        { name: "redactionReport", type: "object", required: false, desc: "Per-system count of redacted records (DB, files, audit log, search index)." }
      ]
    },
    TaxForm: {
      description: "A year-end tax form generated for one worker.",
      fields: [
        { name: "id",        type: "string<ulid>", required: true,  desc: "Form identifier." },
        { name: "workerId",  type: "string<ulid>", required: true,  desc: "Worker the form is for." },
        { name: "taxYear",   type: "integer",      required: true,  desc: "Tax year, e.g. 2026." },
        { name: "formType",  type: "enum",         required: true,  desc: "Form kind.", enum: ["1099_nec", "w2", "t4", "1099_misc"] },
        { name: "totals",    type: "object",       required: true,  desc: "Tax-form line totals — wages, withholding, etc." },
        { name: "status",    type: "enum",         required: true,  desc: "Lifecycle.", enum: ["draft", "ready", "delivered", "corrected", "voided"] },
        { name: "fileId",    type: "string<ulid>", required: false, desc: "Generated PDF in /files. Null until status=ready." },
        { name: "deliveredAt", type: "string<datetime>", required: false, desc: "When the form was delivered to the worker." }
      ]
    },
    BankAccount: {
      description: "A worker's direct-deposit bank account. Account numbers are write-only.",
      fields: [
        { name: "id",            type: "string<ulid>", required: true,  desc: "Account identifier." },
        { name: "workerId",      type: "string<ulid>", required: true,  desc: "Owning worker." },
        { name: "nickname",      type: "string",       required: false, desc: "Worker-supplied nickname, e.g. \"Main checking\"." },
        { name: "accountType",   type: "enum",         required: true,  desc: "Account kind.", enum: ["checking", "savings"] },
        { name: "country",       type: "string<iso3166>", required: true, desc: "Country code." },
        { name: "currency",      type: "string<iso4217>", required: true, desc: "Currency code." },
        { name: "last4",         type: "string",       required: true,  desc: "Last four digits of the account number — the only digits ever returned." },
        { name: "routingNumber", type: "string",       required: false, desc: "Routing number for US accounts (ABA). Returned masked except last 4." },
        { name: "verified",      type: "boolean",      required: true,  desc: "Whether the account passed micro-deposit or Plaid verification." },
        { name: "splitPct",      type: "number",       required: false, desc: "Optional split percentage when the worker has multiple accounts. Must sum to 1.0 across accounts." },
        { name: "createdAt",     type: "string<datetime>", required: true, desc: "When the account was added." }
      ]
    },
    Geofence: {
      description: "A location's geofence used to validate worker clock-in.",
      fields: [
        { name: "locationId", type: "string<ulid>",  required: true,  desc: "Location the fence belongs to." },
        { name: "center",     type: "object",        required: true,  desc: "Center coordinates — `{lat, lng}`." },
        { name: "radiusM",    type: "integer",       required: true,  desc: "Allowed radius in meters." },
        { name: "polygon",    type: "Array<object>", required: false, desc: "Optional GeoJSON polygon overlay. Takes precedence over center+radius when supplied." },
        { name: "enforcement", type: "enum",         required: true,  desc: "What happens on out-of-fence punch.", enum: ["block", "warn", "annotate"] },
        { name: "graceMeters", type: "integer",      required: false, desc: "Extra meters beyond radius treated as in-fence. Defaults to 0." }
      ]
    },
    Punch: {
      description: "A worker punch (clock-in or clock-out) on a shift.",
      fields: [
        { name: "id",        type: "string<ulid>",     required: true,  desc: "Punch identifier." },
        { name: "shiftId",   type: "string<ulid>",     required: true,  desc: "Shift the punch belongs to." },
        { name: "workerId",  type: "string<ulid>",     required: true,  desc: "Worker." },
        { name: "kind",      type: "enum",             required: true,  desc: "Punch kind.", enum: ["clock_in", "clock_out", "break_start", "break_end"] },
        { name: "at",        type: "string<datetime>", required: true,  desc: "Punch timestamp." },
        { name: "lat",       type: "number",           required: false, desc: "Reported latitude." },
        { name: "lng",       type: "number",           required: false, desc: "Reported longitude." },
        { name: "accuracyM", type: "integer",          required: false, desc: "Reported GPS accuracy in meters." },
        { name: "fenceResult", type: "enum",           required: true,  desc: "Geofence validation result.", enum: ["in_fence", "in_grace", "out_of_fence", "no_location"] }
      ]
    }
  });

  /* =========== A-11a · mTLS certificates ========================== */
  add(
    { id: "mtls_list", tag: "mtls",
      method: "GET", path: "/api-keys/{keyId}/certificates",
      name: "List bound certificates",
      summary: "Returns every client certificate bound to one API key. Up to four certificates per key are supported to allow zero-downtime rotation.",
      params: [{ name: "keyId", in: "path", type: "string<ulid>", required: true, desc: "API key." }],
      responses: [{ status: 200, schema: "Array<ClientCertificate>", desc: "Certificate list." }],
      responseExample: [
        { id: "01HZXCRT0001234567890ABCDE", apiKeyId: "01HZXAPI0001234567890ABCDE", subject: "CN=payroll.helios.example,O=Helios,C=US", issuer: "CN=Helios Internal CA,O=Helios,C=US", fingerprint: "9C:4F:2A:18:7D:0B:E3:11:5C:6F:88:0E:DA:7B:21:43:98:0C:5F:1A:6B:EE:90:8D:74:1F:0C:12:88:5E:A1:33", notBefore: "2026-01-15T00:00:00Z", notAfter: "2027-01-15T00:00:00Z", status: "active" }
      ] },

    { id: "mtls_create", tag: "mtls",
      method: "POST", path: "/api-keys/{keyId}/certificates",
      name: "Bind a certificate",
      summary: "Uploads a PEM-encoded X.509 certificate and binds it to an API key. From this point requests using the key must present a matching client certificate at the TLS layer.",
      detail:
        "Send the leaf certificate only; chain certificates are validated against the platform's trust store. Self-signed certificates are accepted on sandbox but rejected in production. " +
        "Rotation pattern: bind the new certificate, deploy clients, then revoke the old. Up to four certificates may be active at once to bridge the deploy window.",
      params: [{ name: "keyId", in: "path", type: "string<ulid>", required: true, desc: "API key." }],
      body: { schema: [
        { name: "certificatePem", type: "string", required: true, desc: "PEM-encoded leaf certificate." },
        { name: "label",          type: "string", required: false, desc: "Operator label — e.g. \"payroll-prod-2026-Q1\"." }
      ], example: { certificatePem: "-----BEGIN CERTIFICATE-----\nMIIDazCCAlOgAwIBAgIULp8\u2026\n-----END CERTIFICATE-----", label: "payroll-prod-2026-Q1" } },
      responses: [
        { status: 201, schema: "ClientCertificate", desc: "Bound." },
        { status: 400, schema: "Error", desc: "Certificate failed validation (expired, untrusted, malformed)." },
        { status: 409, schema: "Error", desc: "Four certificates already bound. Revoke one first." }
      ],
      responseExample: { id: "01HZXCRT0001234567890ABCDE", apiKeyId: "01HZXAPI0001234567890ABCDE", status: "active", notBefore: "2026-01-15T00:00:00Z", notAfter: "2027-01-15T00:00:00Z" } },

    { id: "mtls_delete", tag: "mtls",
      method: "DELETE", path: "/api-keys/{keyId}/certificates/{certificateId}",
      name: "Revoke a certificate",
      summary: "Revokes a bound certificate. Subsequent requests presenting it are rejected at the TLS layer with a 495 ssl_certificate_revoked.",
      detail: "The key itself remains active. Revoking the last certificate on an mTLS-required key locks the key out — pair with the toggle to require / not-require mTLS to avoid the gap.",
      params: [
        { name: "keyId",         in: "path", type: "string<ulid>", required: true, desc: "API key." },
        { name: "certificateId", in: "path", type: "string<ulid>", required: true, desc: "Certificate to revoke." }
      ],
      responses: [{ status: 204, schema: null, desc: "Revoked." }],
      responseExample: null }
  );

  /* =========== A-11b · IP allowlist ============================== */
  add(
    { id: "ipallow_get", tag: "ip-allowlist",
      method: "GET", path: "/api-keys/{keyId}/ip-allowlist",
      name: "Get IP allowlist",
      summary: "Returns the CIDR allowlist on an API key. An empty list means no restriction.",
      params: [{ name: "keyId", in: "path", type: "string<ulid>", required: true, desc: "API key." }],
      responses: [{ status: 200, schema: "IpAllowlist", desc: "Allowlist envelope." }],
      responseExample: { apiKeyId: "01HZXAPI0001234567890ABCDE", cidrs: ["198.51.100.0/24", "203.0.113.42/32", "2001:db8::/32"] } },

    { id: "ipallow_put", tag: "ip-allowlist",
      method: "PUT", path: "/api-keys/{keyId}/ip-allowlist",
      name: "Replace IP allowlist",
      summary: "Replace the full allowlist in one call. Empty array disables the restriction.",
      detail:
        "Requests from outside the allowlist return 403 with type=`request.source_ip_blocked`; the offending IP is recorded in audit. " +
        "Pair with mTLS for a stacked perimeter: certificate authenticates the org, IP allowlist scopes the surface, bearer authenticates the workload.",
      params: [{ name: "keyId", in: "path", type: "string<ulid>", required: true, desc: "API key." }],
      body: { schema: [
        { name: "cidrs", type: "Array<string>", required: true, desc: "IPv4 / IPv6 CIDRs. Up to 50 entries." }
      ], example: { cidrs: ["198.51.100.0/24", "203.0.113.42/32"] } },
      responses: [
        { status: 200, schema: "IpAllowlist", desc: "Saved." },
        { status: 400, schema: "Error", desc: "Invalid CIDR or over the 50-entry cap." }
      ],
      responseExample: { apiKeyId: "01HZXAPI0001234567890ABCDE", cidrs: ["198.51.100.0/24", "203.0.113.42/32"] } }
  );

  /* =========== A-11c · Webhook payload encryption ================= */
  add(
    { id: "wh_enc_set", tag: "webhook-encryption",
      method: "POST", path: "/webhooks/{webhookId}/encryption-key",
      name: "Set an encryption key",
      summary: "Registers a public key the platform will use to envelope-encrypt webhook payloads delivered to this subscription. RSA-OAEP-256 or X25519.",
      detail:
        "Each delivery generates a fresh AES-256 content key, encrypts the payload with it, then encrypts the content key under the receiver's public key. The receiver's HTTP listener decrypts the content key with its private key, then the payload. " +
        "The HMAC signature is still emitted and still authoritative for integrity — encryption is layered on top, not in place of it.",
      params: [{ name: "webhookId", in: "path", type: "string<ulid>", required: true, desc: "Subscription." }],
      body: { schema: [
        { name: "algorithm",     type: "enum",   required: true, desc: "Key-encryption algorithm.", enum: ["RSA-OAEP-256", "X25519"] },
        { name: "publicKeyPem",  type: "string", required: true, desc: "PEM-encoded public key." },
        { name: "keyId",         type: "string", required: true, desc: "Caller-supplied key id, echoed back on every delivery so receivers can route to the right private key." }
      ], example: { algorithm: "RSA-OAEP-256", keyId: "helios-prod-2026Q1", publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG\u2026\n-----END PUBLIC KEY-----" } },
      responses: [{ status: 201, schema: "WebhookEncryptionKey", desc: "Registered." }],
      responseExample: { webhookId: "01HZX0JWHOOK000001234567ABC", keyId: "helios-prod-2026Q1", algorithm: "RSA-OAEP-256", active: true, registeredAt: "2026-05-26T17:22:01Z" } },

    { id: "wh_enc_rotate", tag: "webhook-encryption",
      method: "POST", path: "/webhooks/{webhookId}/encryption-key:rotate",
      name: "Rotate the encryption key",
      summary: "Register a new public key while keeping the previous one valid for a 24-hour overlap. Subsequent deliveries are encrypted under whichever key matches the supplied keyId.",
      params: [{ name: "webhookId", in: "path", type: "string<ulid>", required: true, desc: "Subscription." }],
      body: { schemaRef: "Same shape as POST /webhooks/{id}/encryption-key", example: { algorithm: "RSA-OAEP-256", keyId: "helios-prod-2026Q2", publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG\u2026\n-----END PUBLIC KEY-----" } },
      responses: [{ status: 200, schema: "WebhookEncryptionKeyRotation", desc: "Rotated." }],
      responseExample: { current: { keyId: "helios-prod-2026Q2", registeredAt: "2026-05-26T17:22:01Z" }, previous: { keyId: "helios-prod-2026Q1", validUntil: "2026-05-27T17:22:01Z" } } }
  );

  /* =========== A-11d · Resumable file uploads ===================== */
  add(
    { id: "files_upload_start", tag: "system",
      method: "POST", path: "/files:start-upload",
      name: "Start a resumable upload",
      summary: "Begins a tus.io 1.0 resumable upload. Returns the upload URL and the supported chunk size. Required for files over 25 MB.",
      detail:
        "Follows the tus.io 1.0 protocol for resumable uploads — the platform implements the Core, Creation, and Termination extensions. " +
        "After this call, PATCH chunks to the returned uploadUrl in any order; the platform reassembles by Upload-Offset. " +
        "On the last PATCH the file moves into /files automatically and you receive the final fileId.",
      body: { schema: [
        { name: "filename",   type: "string",  required: true,  desc: "Original filename." },
        { name: "mimeType",   type: "string",  required: true,  desc: "MIME type." },
        { name: "sizeBytes",  type: "integer", required: true,  desc: "Total size. Max 2 GB." },
        { name: "category",   type: "enum",    required: true,  desc: "File category.", enum: ["receipt", "contract", "credential", "id_document", "timesheet_export", "other"] },
        { name: "checksumSha256", type: "string", required: false, desc: "Optional client-computed SHA-256 for end-to-end integrity." }
      ], example: { filename: "phase-2-deliverables.pdf", mimeType: "application/pdf", sizeBytes: 84_221_440, category: "contract" } },
      responses: [
        { status: 201, schema: "ResumableUpload", desc: "Upload started." },
        { status: 413, schema: "Error", desc: "Size exceeds the 2 GB ceiling." }
      ],
      responseExample: { id: "01HZXUPL0001234567890ABCDE", uploadUrl: "https://api.dayforce.com/flex-work/v1/files/uploads/01HZXUPL\u2026", maxChunkBytes: 5_242_880, expiresAt: "2026-05-27T17:22:01Z" } },

    { id: "files_upload_patch", tag: "system",
      method: "PATCH", path: "/files/uploads/{uploadId}",
      name: "Upload a chunk",
      summary: "Append the next chunk to a resumable upload. Send as application/offset+octet-stream with Upload-Offset header per tus.io 1.0.",
      params: [{ name: "uploadId", in: "path", type: "string<ulid>", required: true, desc: "Upload identifier." }],
      responses: [
        { status: 204, schema: null, desc: "Chunk appended. Returns Upload-Offset header with new offset." },
        { status: 200, schema: "File", desc: "Final chunk received; file is now retrievable at /files/{fileId}." },
        { status: 409, schema: "Error", desc: "Upload-Offset doesn't match server state. Re-query and retry." }
      ],
      responseExample: { id: "01HZXFILE0001234567890ABCD", filename: "phase-2-deliverables.pdf", sizeBytes: 84_221_440, mimeType: "application/pdf", category: "contract" } },

    { id: "files_upload_get", tag: "system",
      method: "GET", path: "/files/uploads/{uploadId}",
      name: "Inspect upload state",
      summary: "Returns the current Upload-Offset and remaining bytes. Use to resume an interrupted upload.",
      params: [{ name: "uploadId", in: "path", type: "string<ulid>", required: true, desc: "Upload identifier." }],
      responses: [{ status: 200, schema: "ResumableUploadStatus", desc: "Upload state." }],
      responseExample: { id: "01HZXUPL0001234567890ABCDE", offset: 47_185_920, sizeBytes: 84_221_440, remaining: 37_035_520, expiresAt: "2026-05-27T17:22:01Z" } },

    { id: "files_upload_cancel", tag: "system",
      method: "DELETE", path: "/files/uploads/{uploadId}",
      name: "Cancel an upload",
      summary: "Abort an in-flight resumable upload. Already-uploaded bytes are discarded.",
      params: [{ name: "uploadId", in: "path", type: "string<ulid>", required: true, desc: "Upload identifier." }],
      responses: [{ status: 204, schema: null, desc: "Cancelled." }],
      responseExample: null }
  );

  /* =========== A-11f · Right-to-erasure ========================== */
  add(
    { id: "erase_list", tag: "privacy",
      method: "GET", path: "/privacy/erasure-requests",
      name: "List erasure requests",
      summary: "Paginated list of erasure requests on the org. Used by the privacy console to track DSAR / SAR SLA compliance.",
      params: [
        { name: "status",       in: "query", type: "enum",         required: false, desc: "Filter by status.", enum: ["received", "in_review", "approved", "running", "completed", "rejected"] },
        { name: "subjectType",  in: "query", type: "enum",         required: false, desc: "Filter by subject type.", enum: ["worker", "candidate", "user"] },
        { name: "dueBefore",    in: "query", type: "string<datetime>", required: false, desc: "Requests due on or before this date. Useful for SLA-breach watching." },
        { name: "cursor",       in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<ErasureRequest>", desc: "Request page." }],
      responseExample: { data: [
        { id: "01HZXERA0001234567890ABCDE", subjectType: "worker", subjectId: "01HZX0J8B7P3R2K6F9D5N8M4WT", requestedBy: "01HZX0J0XM7R1F2N6K3L7S5VWE", requestedAt: "2026-05-22T14:08:12Z", dueBy: "2026-06-21T14:08:12Z", status: "in_review" }
      ], nextCursor: null } },

    { id: "erase_create", tag: "privacy",
      method: "POST", path: "/privacy/erasure-requests",
      name: "File an erasure request",
      summary: "File a GDPR right-to-erasure / CCPA delete request against a worker, candidate, or user. Returns the request with its 30-day SLA due date.",
      detail:
        "Filing does not run the erasure — it queues it for review. Some records (timesheets settled by payroll, invoices already in the GL) cannot be deleted per record-retention obligations and are redacted in place instead of removed; the redactionReport on the resolved request breaks this down per backing store. " +
        "Once approved, the request runs as a long-running operation; subscribe to `privacy.erasure.completed` for push-mode notification.",
      body: { schema: [
        { name: "subjectType", type: "enum",         required: true,  desc: "Subject type.", enum: ["worker", "candidate", "user"] },
        { name: "subjectId",   type: "string<ulid>", required: true,  desc: "Subject identifier." },
        { name: "justification", type: "string",     required: true,  desc: "Reason for the request — verbatim from the subject's request. Retained in audit." },
        { name: "verifiedBy",  type: "string",       required: true,  desc: "Identity-verification mechanism used (e.g. \"ID.me\", \"government-id-upload\"). Required for GDPR Article 12." }
      ], example: { subjectType: "worker", subjectId: "01HZX0J8B7P3R2K6F9D5N8M4WT", justification: "GDPR Article 17 erasure request received via privacy@helios.example on 2026-05-22.", verifiedBy: "ID.me" } },
      responses: [{ status: 201, schema: "ErasureRequest", desc: "Request filed." }],
      responseExample: { id: "01HZXERA0001234567890ABCDE", status: "received", requestedAt: "2026-05-26T17:22:01Z", dueBy: "2026-06-25T17:22:01Z" } },

    { id: "erase_get", tag: "privacy",
      method: "GET", path: "/privacy/erasure-requests/{requestId}",
      name: "Get an erasure request",
      summary: "Returns one request with its per-system redaction report when complete.",
      params: [{ name: "requestId", in: "path", type: "string<ulid>", required: true, desc: "Request." }],
      responses: [{ status: 200, schema: "ErasureRequest", desc: "Request envelope." }],
      responseExample: { id: "01HZXERA0001234567890ABCDE", status: "completed", completedAt: "2026-06-12T10:08:00Z", redactionReport: { database: 124, files: 18, audit_log: 1842, search_index: 47, retained_for_compliance: 6 } } }
  );

  /* =========== A-11g · OpenAPI schema diff ======================= */
  add(
    { id: "openapi_diff", tag: "discovery",
      method: "GET", path: "/.well-known/openapi/diff",
      name: "OpenAPI schema diff",
      summary: "Returns the additions, deprecations, and removals between any two pinned schema versions. Powers integrator CI drift detectors and release gates.",
      detail:
        "Both versions must be pinned schema dates (YYYY-MM-DD). The response is structured JSON, not a human document — useful in CI to fail a build when a breaking change lands without the integrator's review. " +
        "For human-readable release notes, see the platform Changelog page.",
      params: [
        { name: "from", in: "query", type: "string<date>", required: true, desc: "Older schema version, YYYY-MM-DD." },
        { name: "to",   in: "query", type: "string<date>", required: true, desc: "Newer schema version, YYYY-MM-DD. Defaults to latest if omitted." }
      ],
      responses: [{ status: 200, schema: "SchemaDiff", desc: "Structured diff." }],
      responseExample: {
        from: "2026-03-01", to: "2026-05-26",
        added: { paths: ["/bookings", "/comments", "/operations/{operationId}", "/scim/v2/Users"], schemas: ["Booking", "Comment", "Operation", "ScimUser"] },
        deprecated: { paths: [], schemas: [] },
        removed: { paths: [], schemas: [] },
        breaking: false
      } }
  );

  /* =========== N-01 · Tax forms =================================== */
  add(
    { id: "taxforms_list", tag: "tax-forms",
      method: "GET", path: "/workers/{workerId}/tax-forms",
      name: "List tax forms for a worker",
      summary: "Returns every tax form generated for one worker across all tax years.",
      params: [
        { name: "workerId", in: "path",  type: "string<ulid>", required: true,  desc: "Worker." },
        { name: "taxYear",  in: "query", type: "integer",      required: false, desc: "Restrict to one year." }
      ],
      responses: [{ status: 200, schema: "Array<TaxForm>", desc: "Tax form list." }],
      responseExample: [
        { id: "01HZXTX10001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", taxYear: 2025, formType: "1099_nec", status: "delivered", totals: { box1_nonemployee_compensation: 84_212.00, currency: "USD" }, deliveredAt: "2026-01-29T18:00:00Z", fileId: "01HZXFILE0001099NEC2025ABC" }
      ] },

    { id: "taxforms_generate", tag: "tax-forms",
      method: "POST", path: "/workers/{workerId}/tax-forms:generate",
      name: "Generate a tax form",
      summary: "Generates a tax form for one worker / one year. Returns an Operation handle; the form moves through draft → ready → delivered as the run progresses.",
      detail:
        "The platform pulls every approved timesheet and invoice for the worker in the tax year, applies the engagement-type's tax treatment (1099 for independent contractors, W-2 for EORs and direct hires, T4 for Canadian payrolls), and renders the PDF. " +
        "Corrected forms get the `corrected` status and a sequence number; the original stays available in audit.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker." }],
      body: { schema: [
        { name: "taxYear",  type: "integer", required: true, desc: "Tax year, e.g. 2026." },
        { name: "formType", type: "enum",    required: true, desc: "Form kind.", enum: ["1099_nec", "w2", "t4", "1099_misc"] },
        { name: "preview",  type: "boolean", required: false, desc: "If true, returns a draft form without delivering. Defaults to false." }
      ], example: { taxYear: 2026, formType: "1099_nec" } },
      responses: [{ status: 202, schema: "Operation", desc: "Generation queued. Result is a TaxForm record." }],
      responseExample: { id: "01HZXOPN0001234567890TAX001", type: "tax_forms.generate", status: "running", startedAt: "2026-05-26T17:22:01Z" } },

    { id: "taxforms_get", tag: "tax-forms",
      method: "GET", path: "/tax-forms/{taxFormId}",
      name: "Get a tax form",
      summary: "Returns one tax form, including a signed download URL for the rendered PDF.",
      params: [{ name: "taxFormId", in: "path", type: "string<ulid>", required: true, desc: "Tax form." }],
      responses: [{ status: 200, schema: "TaxForm", desc: "Tax form envelope." }],
      responseExample: { id: "01HZXTX10001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", taxYear: 2025, formType: "1099_nec", status: "delivered", deliveredAt: "2026-01-29T18:00:00Z", fileId: "01HZXFILE0001099NEC2025ABC" } },

    { id: "taxforms_prefs", tag: "tax-forms",
      method: "PATCH", path: "/workers/{workerId}/tax-form-preferences",
      name: "Update tax-form preferences",
      summary: "Update a worker's delivery preferences and IRS e-consent for tax-form delivery.",
      detail: "Workers must affirmatively consent to electronic delivery per IRS Publication 1179. The consent timestamp is retained for the document-retention window (7 years).",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker." }],
      body: { schema: [
        { name: "deliveryChannel", type: "enum", required: true, desc: "How to deliver.", enum: ["postal", "electronic", "both"] },
        { name: "electronicConsent", type: "boolean", required: false, desc: "Required when deliveryChannel includes electronic. Captures the affirmative consent." },
        { name: "mailingAddressId", type: "string<ulid>", required: false, desc: "Address on file to mail postal copies to." }
      ], example: { deliveryChannel: "electronic", electronicConsent: true } },
      responses: [{ status: 200, schema: "TaxFormPreferences", desc: "Updated preferences." }],
      responseExample: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", deliveryChannel: "electronic", electronicConsent: true, electronicConsentAt: "2026-05-26T17:22:01Z" } }
  );

  /* =========== N-02 · Banking & direct deposit =================== */
  add(
    { id: "bank_list", tag: "banking",
      method: "GET", path: "/workers/{workerId}/bank-accounts",
      name: "List bank accounts",
      summary: "Returns a worker's direct-deposit accounts. Account numbers are NEVER returned — only the last four digits.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker." }],
      responses: [{ status: 200, schema: "Array<BankAccount>", desc: "Account list." }],
      responseExample: [
        { id: "01HZXBNK0001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", nickname: "Main checking", accountType: "checking", country: "US", currency: "USD", last4: "4218", routingNumber: "*****1421", verified: true, splitPct: 1.0, createdAt: "2025-08-04T10:08:12Z" }
      ] },

    { id: "bank_create", tag: "banking",
      method: "POST", path: "/workers/{workerId}/bank-accounts",
      name: "Add a bank account",
      summary: "Add a direct-deposit account. Account number is encrypted at rest immediately; only the last four are retrievable.",
      detail:
        "Worker-initiated flow. The endpoint accepts a raw account+routing pair OR a Plaid Auth public token via the companion `:plaid-link` action. Raw entry requires micro-deposit verification before the account becomes active for payroll.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker." }],
      body: { schema: [
        { name: "nickname",      type: "string", required: false, desc: "Display label." },
        { name: "accountType",   type: "enum",   required: true,  desc: "Account kind.", enum: ["checking", "savings"] },
        { name: "accountNumber", type: "string", required: true,  desc: "Account number. Encrypted on receipt; never returned." },
        { name: "routingNumber", type: "string", required: true,  desc: "Routing number (ABA / IBAN / etc.)." },
        { name: "country",       type: "string<iso3166>", required: true, desc: "Country code." },
        { name: "currency",      type: "string<iso4217>", required: true, desc: "Currency code." },
        { name: "splitPct",      type: "number", required: false, desc: "Optional split share (0-1) when multiple accounts exist." }
      ], example: { nickname: "Main checking", accountType: "checking", accountNumber: "000123454218", routingNumber: "021000021", country: "US", currency: "USD" } },
      responses: [
        { status: 201, schema: "BankAccount", desc: "Account added; pending verification." },
        { status: 422, schema: "Error", desc: "Routing number failed checksum / not in ABA registry." }
      ],
      responseExample: { id: "01HZXBNK0001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", accountType: "checking", country: "US", currency: "USD", last4: "4218", verified: false, createdAt: "2026-05-26T17:22:01Z" } },

    { id: "bank_delete", tag: "banking",
      method: "DELETE", path: "/workers/{workerId}/bank-accounts/{accountId}",
      name: "Remove a bank account",
      summary: "Remove a direct-deposit account. If it was the worker's only verified account, payroll is paused until a replacement is added and verified.",
      params: [
        { name: "workerId",  in: "path", type: "string<ulid>", required: true, desc: "Worker." },
        { name: "accountId", in: "path", type: "string<ulid>", required: true, desc: "Account to remove." }
      ],
      responses: [{ status: 204, schema: null, desc: "Removed." }],
      responseExample: null },

    { id: "bank_plaid", tag: "banking",
      method: "POST", path: "/workers/{workerId}/bank-accounts:plaid-link",
      name: "Link via Plaid Auth",
      summary: "Exchanges a Plaid Auth public_token for one or more verified bank accounts on the worker. The account is created in a verified state — no micro-deposit step required.",
      detail:
        "Use Plaid's Link client SDK to obtain the public_token, then POST it here. The platform fetches the institution, account, and routing details server-side and stores the encrypted account number. " +
        "Plaid handoff is the recommended entry path — it removes the 1-3 business day micro-deposit wait and avoids exposing the account number to the worker's device.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker." }],
      body: { schema: [
        { name: "publicToken",  type: "string", required: true, desc: "Plaid Link public_token." },
        { name: "accountIds",   type: "Array<string>", required: false, desc: "Plaid account ids to import. Defaults to all checking + savings accounts on the institution." }
      ], example: { publicToken: "public-sandbox-c81e728d-9d4c-2f63-6f06-7f89cc14862c" } },
      responses: [{ status: 201, schema: "Array<BankAccount>", desc: "Created accounts, all in verified state." }],
      responseExample: [
        { id: "01HZXBNK0001234567890PLAID", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", nickname: "Chase checking ...4218", accountType: "checking", country: "US", currency: "USD", last4: "4218", verified: true, splitPct: 1.0, createdAt: "2026-05-26T17:22:01Z" }
      ] }
  );

  /* =========== N-03 · Geofence + clock-in ======================== */
  add(
    { id: "geo_get", tag: "clocking",
      method: "GET", path: "/locations/{locationId}/geofence",
      name: "Get a location's geofence",
      summary: "Returns the geofence config (center + radius OR polygon) for a location.",
      params: [{ name: "locationId", in: "path", type: "string<ulid>", required: true, desc: "Location." }],
      responses: [{ status: 200, schema: "Geofence", desc: "Geofence envelope." }, { status: 404, schema: "Error", desc: "No geofence configured." }],
      responseExample: { locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", center: { lat: 39.7088, lng: -119.8138 }, radiusM: 180, enforcement: "warn", graceMeters: 25 } },

    { id: "geo_set", tag: "clocking",
      method: "PUT", path: "/locations/{locationId}/geofence",
      name: "Set a location's geofence",
      summary: "Replace the geofence config for a location.",
      detail:
        "`block` enforcement rejects out-of-fence punches outright; `warn` accepts the punch but flags it for review; `annotate` accepts and records the result without flagging. Recommended starting point: `warn` with a 25m grace for the first quarter, then move to `block` once attendance data confirms the fence is sized correctly.",
      params: [{ name: "locationId", in: "path", type: "string<ulid>", required: true, desc: "Location." }],
      body: { schemaRef: "Geofence (without locationId)", example: { center: { lat: 39.7088, lng: -119.8138 }, radiusM: 180, enforcement: "warn", graceMeters: 25 } },
      responses: [{ status: 200, schema: "Geofence", desc: "Saved." }],
      responseExample: { locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", center: { lat: 39.7088, lng: -119.8138 }, radiusM: 180, enforcement: "warn", graceMeters: 25 } },

    { id: "punch_in", tag: "clocking",
      method: "POST", path: "/shifts/{shiftId}:clock-in",
      name: "Clock in",
      summary: "Worker-side punch-in. Validated against the location's geofence; the result is recorded on the punch and visible in attendance reports.",
      detail:
        "Out-of-fence punches behave per the location's enforcement mode. On `block`, the response is 403 with type=`clock_in.out_of_fence`; on `warn` or `annotate`, the punch is accepted with `fenceResult=out_of_fence`. " +
        "GPS accuracy is reported but advisory — punches with poor accuracy (>50 m) are tagged `accuracy_low` for downstream review.",
      params: [{ name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift to clock in on." }],
      body: { schema: [
        { name: "at",         type: "string<datetime>", required: false, desc: "Punch timestamp. Defaults to server-now." },
        { name: "lat",        type: "number", required: false, desc: "Reported latitude." },
        { name: "lng",        type: "number", required: false, desc: "Reported longitude." },
        { name: "accuracyM",  type: "integer", required: false, desc: "Reported GPS accuracy in meters." }
      ], example: { lat: 39.7090, lng: -119.8141, accuracyM: 12 } },
      responses: [
        { status: 201, schema: "Punch", desc: "Punch recorded." },
        { status: 403, schema: "Error", desc: "Out-of-fence punch rejected by enforcement=block." }
      ],
      responseExample: { id: "01HZXPNCH001234567890CLK1", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "clock_in", at: "2026-05-26T22:00:08Z", lat: 39.7090, lng: -119.8141, accuracyM: 12, fenceResult: "in_fence" } },

    { id: "punch_out", tag: "clocking",
      method: "POST", path: "/shifts/{shiftId}:clock-out",
      name: "Clock out",
      summary: "Worker-side punch-out. Same geofence semantics as clock-in. Closes the shift's labor window for the timesheet engine.",
      params: [{ name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift to clock out on." }],
      body: { schemaRef: "Same shape as :clock-in", example: { lat: 39.7090, lng: -119.8141, accuracyM: 18 } },
      responses: [
        { status: 201, schema: "Punch", desc: "Punch recorded." },
        { status: 409, schema: "Error", desc: "No matching clock_in punch on this shift." }
      ],
      responseExample: { id: "01HZXPNCH001234567890CLK2", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "clock_out", at: "2026-05-27T06:00:42Z", lat: 39.7090, lng: -119.8141, accuracyM: 18, fenceResult: "in_fence" } }
  );

})();
