// node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify: Netlify2, process: process2 } = globalThis;
  return Netlify2?.env ?? Deno?.env ?? {
    delete: (key) => delete process2?.env[key],
    get: (key) => process2?.env[key],
    has: (key) => Boolean(process2?.env[key]),
    set: (key, value) => {
      if (process2?.env) {
        process2.env[key] = value;
      }
    },
    toObject: () => process2?.env ?? {}
  };
};

// node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/@netlify/blobs/dist/chunk-FWVYH726.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    return `Netlify Blobs could not write to store '${storeName}' (${details}). Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  return `Netlify Blobs has generated an internal error (${details})`;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}) {
    super(blobsErrorMessage(res, context));
    this.name = "BlobsInternalError";
  }
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch2, url, options, attemptsLeft = MAX_RETRY) => {
  try {
    const res = await fetch2(url, options);
    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      return fetchAndRetry(fetch2, url, options, attemptsLeft - 1);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    return fetchAndRetry(fetch2, url, options, attemptsLeft - 1);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  constructor({ apiURL, consistency, edgeURL, fetch: fetch2, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch2 ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res, { method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    return fetchAndRetry(this.fetch, url, options);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, { method: "delete", storeName: this.name });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        throw new BlobsInternalError(res, { method: "delete", storeName: this.name });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res, { method: "put", storeName: this.name });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res, { method: "put", storeName: this.name });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const clientOptions = getClientOptions(input);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// netlify/api-source.mjs
var DEFAULT_MAPS = "https://maps.app.goo.gl/qZxyPVoW5e4ZdFVg8?g_st=ic";
function staffPassword() {
  try {
    if (globalThis.Netlify && Netlify.env) {
      const value = Netlify.env.get("ADMIN_PASSWORD");
      if (value) return value;
    }
  } catch (error) {
  }
  return process.env.ADMIN_PASSWORD || "";
}
function env(name) {
  try {
    if (globalThis.Netlify && Netlify.env) {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (error) {
  }
  return process.env[name] || "";
}
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function cleanText(value, limit) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
}
function cleanPrice(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}
function cleanId(value, fallback) {
  const raw = String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  return raw || fallback;
}
function cleanImage(value) {
  const text = String(value || "").trim();
  if (/^photos\/[A-Za-z0-9._-]{1,80}$/.test(text)) return text;
  if (/^\/api\/photo\?id=[a-z0-9-]{1,60}$/.test(text)) return text;
  return "";
}
function cleanLines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 12).map(function(row) {
    const name = cleanText(row && row.name, 40);
    const price = cleanPrice(row && row.price);
    return name && price ? { name, price } : null;
  }).filter(Boolean);
}
function uniqueIds(items) {
  const seen = /* @__PURE__ */ new Set();
  items.forEach(function(item) {
    if (!item.id) return;
    const base = item.id;
    let number = 2;
    while (seen.has(item.id)) {
      item.id = (base.slice(0, 36) + "-" + number).slice(0, 40);
      number += 1;
    }
    seen.add(item.id);
  });
}
function cleanMenu(body) {
  if (!body || !Array.isArray(body.food) || !Array.isArray(body.drinks)) {
    throw new Error("The menu could not be read.");
  }
  if (body.food.length > 80 || body.drinks.length > 40) throw new Error("That is too many items.");
  const food = body.food.map(function(item) {
    const name = cleanText(item && item.name, 80);
    if (!name) throw new Error("Each food needs a name and a price.");
    const cleaned = {
      category: ["Meats", "Dishes", "Fasting"].indexOf(item.category) >= 0 ? item.category : "Dishes",
      id: cleanId(item.id, "item"),
      name,
      am: cleanText(item.am, 80),
      image: cleanImage(item.image),
      available: item.available !== false
    };
    if (item.feature === true) cleaned.feature = true;
    if (item.share === true) cleaned.share = true;
    if (Array.isArray(item.sizes) && item.sizes.length) {
      const sizes = cleanLines(item.sizes);
      if (!sizes.length) throw new Error(name + " needs a price.");
      cleaned.sizes = sizes;
    } else {
      const price = cleanPrice(item.price);
      if (!price) throw new Error(name + " needs a price.");
      cleaned.price = price;
    }
    return cleaned;
  });
  const drinks = body.drinks.map(function(item) {
    const name = cleanText(item && item.name, 80);
    if (!name) throw new Error("Each drink needs a name and a price.");
    const category = ["Spirits", "Soft drinks"].indexOf(item.category) >= 0 ? item.category : "Spirits";
    const key = Array.isArray(item.rows) ? "rows" : "sizes";
    const lines = cleanLines(item[key]);
    if (!lines.length) throw new Error(name + " needs a price.");
    const cleaned = { category, name };
    cleaned[key] = lines;
    if (item.id) cleaned.id = cleanId(item.id, "drink");
    return cleaned;
  });
  const infoIn = body.info || {};
  const phones = (Array.isArray(infoIn.phones) ? infoIn.phones : []).slice(0, 2).map(function(phone) {
    return cleanText(phone, 24);
  }).filter(Boolean);
  if (!phones.length) throw new Error("Add a phone number.");
  let maps = String(infoIn.maps || "");
  if (!maps.startsWith("https://") || maps.length > 300) maps = DEFAULT_MAPS;
  let tiktok = cleanText(infoIn.tiktok || "@sheger_kurt", 40);
  if (tiktok && tiktok.charAt(0) !== "@") tiktok = "@" + tiktok;
  const address = cleanText(infoIn.address, 180);
  if (!address) throw new Error("Add the address.");
  uniqueIds(food);
  uniqueIds(drinks);
  const fee = cleanPrice(infoIn.deliveryFee != null ? infoIn.deliveryFee : "100") || "100";
  return {
    info: { address, maps, phones, tiktok: tiktok || "@sheger_kurt", deliveryFee: fee },
    food,
    drinks,
    home: cleanHome(body.home)
  };
}
function cleanHomeSrc(value) {
  const text = String(value || "").trim();
  if (/^\/api\/home-media\?id=[a-z0-9-]{1,60}$/.test(text)) return text;
  if (/^home-media\/[A-Za-z0-9._-]{1,80}$/.test(text)) return text;
  return "";
}
function cleanHome(home) {
  const rows = home && Array.isArray(home.media) ? home.media : [];
  const media = rows.slice(0, 24).map(function(row) {
    const id = cleanId(row && row.id, "");
    const type = row && row.type === "video" ? "video" : "photo";
    const src = cleanHomeSrc(row && row.src);
    if (!id || !src) return null;
    return {
      id,
      type,
      src,
      caption: cleanText(row && row.caption, 80)
    };
  }).filter(Boolean);
  return { media };
}
function mediaTypeFromBytes(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 255 && bytes[1] === 216) return { type: "photo", contentType: "image/jpeg" };
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    return { type: "photo", contentType: "image/png" };
  }
  if (bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) {
    return { type: "video", contentType: "video/webm" };
  }
  const head = String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.slice(4, 12)));
  if (head.indexOf("ftyp") >= 0) return { type: "video", contentType: "video/mp4" };
  return null;
}
function authorized(req) {
  const expected = staffPassword();
  if (!expected) return "missing";
  const header = req.headers.get("authorization") || "";
  const token = header.indexOf("Bearer ") === 0 ? header.slice(7) : "";
  return same(token, expected) ? "ok" : "no";
}
function menuForGitHub(menu) {
  const copy = JSON.parse(JSON.stringify(menu));
  (copy.food || []).forEach(function(item) {
    const match = String(item.image || "").match(/^\/api\/photo\?id=([a-z0-9-]+)$/i);
    if (match) item.image = "photos/" + match[1] + ".jpg";
  });
  return copy;
}
function githubConfig() {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO") || "Misge1st/sheger-lounge";
  const branch = env("GITHUB_BRANCH") || "main";
  if (!token) return null;
  return { token, repo, branch };
}
function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}
async function githubGetSha(cfg, path) {
  const res = await fetch(
    "https://api.github.com/repos/" + cfg.repo + "/contents/" + path + "?ref=" + encodeURIComponent(cfg.branch),
    {
      headers: {
        Authorization: "Bearer " + cfg.token,
        Accept: "application/vnd.github+json",
        "User-Agent": "sheger-lounge"
      }
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error("GitHub read failed (" + res.status + "): " + text.slice(0, 160));
  }
  const data = await res.json();
  return data.sha || null;
}
async function githubPutFile(cfg, path, contentBase64, message) {
  const sha = await githubGetSha(cfg, path);
  const body = {
    message,
    content: contentBase64,
    branch: cfg.branch
  };
  if (sha) body.sha = sha;
  const res = await fetch("https://api.github.com/repos/" + cfg.repo + "/contents/" + path, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "sheger-lounge"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("GitHub write failed (" + res.status + "): " + text.slice(0, 160));
  }
  return true;
}
async function syncMenuToGitHub(menu) {
  const cfg = githubConfig();
  if (!cfg) return { ok: false, skipped: true };
  const text = JSON.stringify(menuForGitHub(menu), null, 2) + "\n";
  const encoded = typeof Buffer !== "undefined" ? Buffer.from(text, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(text)));
  await githubPutFile(cfg, "site/data/menu.json", encoded, "Update menu from Sheger Lounge staff");
  return { ok: true };
}
async function syncPhotoToGitHub(photoId, bytes) {
  const cfg = githubConfig();
  if (!cfg) return { ok: false, skipped: true };
  const path = "site/photos/" + photoId + ".jpg";
  await githubPutFile(cfg, path, toBase64(bytes), "Update photo " + photoId + " from staff");
  return { ok: true };
}
async function loadOrders(store) {
  const data = await store.get("orders", { type: "json" });
  if (!data || !Array.isArray(data.orders)) return { nextId: 1001, orders: [] };
  return { nextId: Number(data.nextId) || 1001, orders: data.orders };
}
function cleanOrder(body, deliveryFee) {
  if (!body || !Array.isArray(body.items) || !body.items.length) throw new Error("Add food to your order.");
  if (body.items.length > 40) throw new Error("That order is too large.");
  const items = body.items.map(function(row) {
    const name2 = cleanText(row && row.name, 80);
    const size = cleanText(row && row.size, 40);
    const qty = Math.min(99, Math.max(1, Number(row && row.qty) || 0));
    const unit = Number(String(row && row.price || "").replace(/\D/g, ""));
    if (!name2 || !qty || !unit) throw new Error("Each item needs a name, amount, and price.");
    return {
      key: cleanText(row.key, 80) || cleanId(name2 + "-" + size, "item"),
      name: name2,
      size,
      qty,
      price: unit
    };
  });
  const foodTotal = items.reduce(function(sum, row) {
    return sum + row.price * row.qty;
  }, 0);
  const fee = Number(String(deliveryFee || "100").replace(/\D/g, "")) || 100;
  const customer = body.customer || {};
  const name = cleanText(customer.name, 80);
  const phone = cleanText(customer.phone, 24);
  const city = cleanText(customer.city, 60);
  const area = cleanText(customer.area, 80);
  const address = cleanText(customer.address, 200);
  const note = cleanText(customer.note, 300);
  if (!name) throw new Error("Add your full name.");
  if (!phone || phone.replace(/\D/g, "").length < 9) throw new Error("Add a phone number.");
  if (!city) throw new Error("Add your city.");
  if (!area) throw new Error("Add your area / sub-city.");
  if (!address) throw new Error("Add the delivery address.");
  const payment = ["cash", "mobile", "other"].indexOf(body.payment) >= 0 ? body.payment : "cash";
  const map = body.map || {};
  const lat = Number(map.lat);
  const lng = Number(map.lng);
  let mapUrl = cleanText(map.url, 300);
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && !mapUrl) {
    throw new Error("Allow your current location.");
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && !mapUrl) {
    mapUrl = "https://www.google.com/maps?q=" + lat + "," + lng;
  }
  return {
    items,
    foodTotal,
    deliveryFee: fee,
    total: foodTotal + fee,
    customer: { name, phone, city, area, address, note },
    map: {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      url: mapUrl
    },
    payment
  };
}
async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const store = getStore("sheger-menu");
  if (path.endsWith("/login") && req.method === "POST") {
    const expected = staffPassword();
    if (!expected) return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    const body = await req.json().catch(function() {
      return {};
    });
    if (!same(String(body.password || ""), expected)) return json({ error: "That password is not right." }, 401);
    return json({ ok: true });
  }
  if (path.endsWith("/menu") && req.method === "GET") {
    const menu = await store.get("menu", { type: "json" });
    if (!menu) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    return json(menu);
  }
  if (path.endsWith("/menu") && req.method === "PUT") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    let body;
    try {
      body = cleanMenu(await req.json());
    } catch (error) {
      return json({ error: error.message || "The menu could not be read." }, 400);
    }
    await store.setJSON("menu", body);
    let github = { ok: false, skipped: true };
    try {
      github = await syncMenuToGitHub(body);
    } catch (error) {
      github = { ok: false, error: error.message || "GitHub sync failed." };
    }
    return json({ ok: true, github });
  }
  if (path.endsWith("/photo") && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,60}$/.test(id)) return new Response(null, { status: 404 });
    const bytes = await store.get("photo:" + id, { type: "arrayBuffer" });
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  }
  if (path.endsWith("/photo") && req.method === "POST") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return json({ error: "Choose the dish again, then add the photo." }, 400);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length < 100 || bytes.length > 12e5 || bytes[0] !== 255 || bytes[1] !== 216) {
      return json({ error: "Use a photo from the phone." }, 400);
    }
    const stamp = Date.now().toString();
    const stored = (id + "-" + stamp).slice(0, 60);
    await store.set("photo:" + stored, bytes);
    let github = { ok: false, skipped: true };
    try {
      github = await syncPhotoToGitHub(stored, bytes);
    } catch (error) {
      github = { ok: false, error: error.message || "GitHub photo sync failed." };
    }
    return json({ image: "/api/photo?id=" + stored, github });
  }
  if ((/\/home-media\/?$/.test(path) || path.indexOf("/home-media") >= 0) && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,60}$/.test(id)) return new Response(null, { status: 404 });
    const bytes = await store.get("home:" + id, { type: "arrayBuffer" });
    if (!bytes) return new Response(null, { status: 404 });
    const view = new Uint8Array(bytes);
    const kind = mediaTypeFromBytes(view) || { type: "photo", contentType: "application/octet-stream" };
    return new Response(bytes, { headers: { "content-type": kind.contentType, "cache-control": "no-store" } });
  }
  if ((/\/home-media\/?$/.test(path) || path.indexOf("/home-media") >= 0) && req.method === "POST") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const want = url.searchParams.get("type") === "video" ? "video" : "photo";
    const bytes = new Uint8Array(await req.arrayBuffer());
    const max = want === "video" ? 45e5 : 12e5;
    if (bytes.length < 100 || bytes.length > max) {
      return json({
        error: want === "video" ? "Use a short video under about 4 MB." : "Use a photo from the phone."
      }, 400);
    }
    const kind = mediaTypeFromBytes(bytes);
    if (!kind || kind.type !== want) {
      return json({
        error: want === "video" ? "Use an MP4 or WebM video." : "Use a photo from the phone."
      }, 400);
    }
    const stored = ("hm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7)).slice(0, 60);
    await store.set("home:" + stored, bytes);
    return json({
      id: stored,
      type: kind.type,
      src: "/api/home-media?id=" + stored
    });
  }
  if (path.endsWith("/orders/count") && req.method === "GET") {
    const data = await loadOrders(store);
    const pending = data.orders.filter(function(order) {
      return order.status === "new" || order.status === "accepted";
    }).length;
    return json({ pending });
  }
  if (path.endsWith("/orders") && req.method === "GET") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const data = await loadOrders(store);
    return json({ orders: data.orders.slice(0, 120) });
  }
  if (path.endsWith("/orders") && req.method === "POST") {
    let payload;
    try {
      const body = await req.json();
      const menu = await store.get("menu", { type: "json" });
      const fee = menu && menu.info ? menu.info.deliveryFee : "100";
      payload = cleanOrder(body, fee);
    } catch (error) {
      return json({ error: error.message || "The order could not be placed." }, 400);
    }
    const data = await loadOrders(store);
    const order = Object.assign({
      id: data.nextId,
      status: "new",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, payload);
    data.nextId += 1;
    data.orders.unshift(order);
    if (data.orders.length > 300) data.orders.length = 300;
    await store.setJSON("orders", data);
    return json({ ok: true, id: order.id });
  }
  if (path.endsWith("/orders") && req.method === "PATCH") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const body = await req.json().catch(function() {
      return {};
    });
    const id = Number(body.id);
    const status = body.status;
    if (!id || ["new", "accepted", "done", "cancelled"].indexOf(status) < 0) {
      return json({ error: "Choose an order status." }, 400);
    }
    const data = await loadOrders(store);
    const order = data.orders.find(function(row) {
      return row.id === id;
    });
    if (!order) return json({ error: "That order was not found." }, 404);
    order.status = status;
    await store.setJSON("orders", data);
    return json({ ok: true, order });
  }
  return json({ error: "Not found." }, 404);
}
export {
  handler as default
};
