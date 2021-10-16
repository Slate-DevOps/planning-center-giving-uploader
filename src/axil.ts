export class axil {
  baseURL: string;
  headers?: Headers;

  constructor(baseURL: string, headers?: Headers) {
    this.baseURL = baseURL;
    this.headers = headers;
  }

  async get(urlEndPoint: string) {
    const res = await fetch(this.baseURL + urlEndPoint, {
      method: "GET",
      headers: this.headers,
    });
    return await res.json();
  }

  async post(urlEndPoint: string, body: unknown) {
    const res = await fetch(this.baseURL + urlEndPoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return await res.json();
  }
}