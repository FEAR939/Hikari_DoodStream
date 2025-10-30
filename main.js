// Constants
const DOODSTREAM_BASE_URL = "https://dood.li";
const RANDOM_STRING_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PASS_MD5_PATTERN = /\$\.get\('([^']*\/pass_md5\/[^']*)'/;
const TOKEN_PATTERN = /token=([a-zA-Z0-9]+)/;
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

// Random User Agent (you can customize this)
const RANDOM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

export class Extension {
  constructor() {
    this.name = "Doodstream";
  }

  /**
   * Get request headers for Doodstream
   * @returns {Object} Headers object
   */
  _getHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: `${DOODSTREAM_BASE_URL}/`,
      Origin: "https://dood.li",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
  }

  /**
   * Make HTTP request with error handling
   * @param {string} url - URL to fetch
   * @param {Object} headers - Request headers
   * @returns {Promise<Response>} Fetch response
   */
  async _makeRequest(url, headers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        DEFAULT_REQUEST_TIMEOUT,
      );

      const response = await fetch(url, {
        headers: headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error(`Request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract data using regex pattern
   * @param {RegExp} pattern - Regex pattern
   * @param {string} content - Content to search
   * @returns {string|null} Extracted data or null
   */
  _extractData(pattern, content) {
    const match = content.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Generate random alphanumeric string
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  _generateRandomString(length = 10) {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += RANDOM_STRING_CHARS.charAt(
        Math.floor(Math.random() * RANDOM_STRING_CHARS.length),
      );
    }
    return result;
  }

  /**
   * Extract pass_md5 URL from page content
   * @param {string} content - Page content
   * @param {string} embedUrl - Embed URL
   * @returns {string} Pass MD5 URL
   */
  _extractPassMd5Url(content, embedUrl) {
    const passMd5Url = this._extractData(PASS_MD5_PATTERN, content);

    if (!passMd5Url) {
      throw new Error(`pass_md5 URL not found in ${embedUrl}`);
    }

    // Ensure URL is properly formed
    let fullUrl = passMd5Url;
    if (!passMd5Url.startsWith("http")) {
      fullUrl = new URL(passMd5Url, DOODSTREAM_BASE_URL).href;
    }

    console.log(`Extracted pass_md5 URL: ${fullUrl}`);
    return fullUrl;
  }

  /**
   * Extract token from page content
   * @param {string} content - Page content
   * @param {string} embedUrl - Embed URL
   * @returns {string} Token
   */
  _extractToken(content, embedUrl) {
    const token = this._extractData(TOKEN_PATTERN, content);

    if (!token) {
      throw new Error(`Token not found in ${embedUrl}`);
    }

    console.log(`Extracted token: ${token}`);
    return token;
  }

  /**
   * Get video base URL from pass_md5 endpoint
   * @param {string} passMd5Url - Pass MD5 URL
   * @param {Object} headers - Request headers
   * @returns {Promise<string>} Video base URL
   */
  async _getVideoBaseUrl(passMd5Url, headers) {
    try {
      const md5Response = await this._makeRequest(passMd5Url, headers);
      const videoBaseUrl = (await md5Response.text()).trim();

      if (!videoBaseUrl) {
        throw new Error("Empty video base URL received");
      }

      console.log(`Retrieved video base URL: ${videoBaseUrl}`);
      return videoBaseUrl;
    } catch (error) {
      console.error(`Failed to get video base URL from ${passMd5Url}:`, error);
      throw error;
    }
  }

  /**
   * Build the final direct link
   * @param {string} videoBaseUrl - Video base URL
   * @param {string} token - Token
   * @returns {string} Direct link
   */
  _buildDirectLink(videoBaseUrl, token) {
    const randomString = this._generateRandomString(10);
    const expiry = Math.floor(Date.now() / 1000);
    const directLink = `${videoBaseUrl}${randomString}?token=${token}&expiry=${expiry}`;

    console.log(`Built direct link: ${directLink}`);
    return directLink;
  }

  /**
   * Extract direct download link from Doodstream embed URL
   * @param {string} embededDoodstreamLink - Doodstream embed URL
   * @returns {Promise<string>} Direct download link
   */
  async getDirectLink(embededDoodstreamLink) {
    if (!embededDoodstreamLink) {
      throw new Error("Embed URL cannot be empty");
    }

    console.log(
      `Extracting direct link from Doodstream: ${embededDoodstreamLink}`,
    );

    try {
      const headers = this._getHeaders();

      // Get initial page content
      console.log("Fetching embed page content...");
      const response = await this._makeRequest(embededDoodstreamLink, headers);
      const content = await response.text();

      // Extract pass_md5 URL and token
      const passMd5Url = this._extractPassMd5Url(
        content,
        embededDoodstreamLink,
      );
      const token = this._extractToken(content, embededDoodstreamLink);

      // Get video base URL
      const videoBaseUrl = await this._getVideoBaseUrl(passMd5Url, headers);

      // Build final direct link
      const directLink = this._buildDirectLink(videoBaseUrl, token);

      console.log("Successfully extracted Doodstream direct link");
      return directLink;
    } catch (error) {
      console.error(`Failed to extract direct link from Doodstream:`, error);
      throw error;
    }
  }

  /**
   * Get metadata from Doodstream embed URL
   * @param {string} url - Doodstream embed URL
   * @returns {Promise<Object>} Metadata object with mp4, name, quality, and size
   */
  async getMetadata(url) {
    try {
      // Get the direct link
      const mp4Url = await this.getDirectLink(url);

      // Extract file name from URL or use default
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const fileId = pathParts[pathParts.length - 1] || "video";
      const fileName = `doodstream_${fileId}.mp4`;

      // Try to get file size from HEAD request
      let fileSize = null;
      // try {
      //   const headResponse = await fetch(mp4Url, {
      //     method: "HEAD",
      //     headers: this._getHeaders(),
      //   });

      //   const contentLength = headResponse.headers.get("content-length");
      //   if (contentLength) {
      //     fileSize = parseInt(contentLength, 10);
      //   }
      // } catch (error) {
      //   console.warn("Could not fetch file size:", error);
      // }

      return {
        mp4: mp4Url,
        name: fileName,
        quality: "Unknown", // Doodstream doesn't provide quality info in embed
        size: fileSize,
        headers: this._getHeaders(),
      };
    } catch (error) {
      console.error("Failed to get metadata:", error);
      throw error;
    }
  }
}
