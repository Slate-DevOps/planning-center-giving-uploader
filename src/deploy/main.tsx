   
import { h, renderSSR, Component } from "https://deno.land/x/nano_jsx@v0.0.20/mod.ts";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { Importer } from "../importer.ts";
import { Observer, StatusCode, Subject } from "../importerWatcher.ts";

class ErrorReporter implements Observer {
  socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  update(
    _from: Subject,
    message: string,
    code: StatusCode,
    object?: unknown,
  ): void {
    let script = null;
    switch (code) {
      case StatusCode.error:
        script = `console.log("error reported: ${message}");`;
        break;
      case StatusCode.error_duplicate_profile:
      case StatusCode.error_payment_source:
        script = `alert("${message}");`;
        break;
      case StatusCode.failed_donation:
        script = `console.log("donation failed: ${message}");`;
        break;
      case StatusCode.successful_donation:
        script = `console.log("donation uploaded: ${message}");`;
        break;
    }
    if (script) {
      this.socket.send(JSON.stringify({update: true, value: renderSSR(<App />), script: script}));
    }
  }
}

const options = {
  client_id: Deno.env.get('PCOID')!,
  client_secret: Deno.env.get('PCOS')!,
  scopes: 'people+giving', // Scopes limit access for OAuth tokens.
};

const port = 4444;
let url = Deno.env.get('URL');
let redirect_uri;
if (url) {
  redirect_uri = `${url}/auth/complete`;
} else {
  url = `http://localhost`;
  redirect_uri = `${url}:${port}/auth/complete`;
}
const api_url = 'https://api.planningcenteronline.com/oauth/authorize'

const authUrl = new URL(api_url);
authUrl.searchParams.append("client_id", options.client_id)
authUrl.searchParams.append("redirect_uri", redirect_uri);
authUrl.searchParams.append("response_type", 'code')
authUrl.searchParams.append("scope", '')

const router = new Router();
let code, token, token_res, token_json;
router.get("/", (ctx) => {
  ctx.response.redirect(authUrl + options.scopes);
});

router.get("/auth/complete", async (ctx) => {
  code = ctx.request.url.search.replace("?code=", '');
  token_res = await getToken(code);
  token_json = await token_res.json();
  token = token_json.access_token;
  ctx.response.redirect(`${url}/load`)
})

router.get("/load", async (ctx) => {
  //Pass a script tag to the browser to setup the websocket
  ctx.response.body = 
  `<html>
    <head>
      <style>
        .button {
            background: None; 
            border-radius: 5px; 
            border: 2px solid rgb(59, 130, 246); 
            margin: 1em 1em 1em 0; 
            padding: 0.25em; 
            transition: background-color .25s;
            box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.452);
        }
        .button:hover {
            background: rgb(59, 130, 246);
            color: white;
        }
        body {
            font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";  
            background: linear-gradient(70deg, rgb(181, 204, 255), rgb(255, 233, 237));
        }
        .box {
            background:rgb(255, 255, 255); 
            border-radius: 10px; 
            box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.452); 
            width: fit-content; 
            padding: 20px; 
            margin: auto;
        }
      </style>
      <script>
        //This script can be moved into a separate file later
        const ws = new WebSocket('${url.replace("http", "ws")}/ws');
        ws.onopen = function() {
          ws.send(JSON.stringify({endpoint: "form"}));
        }
        ws.onmessage = function(e) {
          const data = JSON.parse(e.data)
          if(data.update === true){
            document.getElementById("body").innerHTML = data.value
          }
          if(data.script !== undefined){
            eval(data.script)
          }
        }
      </script>
    </head>
    <body id = "body">
    </body>
  </html>`;
});

router.get('/ws', async ctx => {
  console.log("web socket time!")
  const sock = await ctx.upgrade();
  sock.onopen = () => {
  };
  sock.onmessage = async (e) => {
    const data = JSON.parse(e.data)
    if(data.endpoint === "form"){
      sock.send(JSON.stringify({update: true, value: renderSSR(<App />), script: `
  const form = document.getElementById("form");
  const filePicker = document.getElementById("file");
  filePicker.addEventListener("change", (event) => {
    const data = new FormData(form);
    document.getElementById("selected_file_name").innerHTML = data.get("file").name;
  });
  form.addEventListener('submit', async function(e) {
    document.getElementById("submit").attr("disabled", true);
    e.preventDefault();
    let fileRead = new FileReader();
    const data = new FormData(form);
    await fileRead.readAsText(data.get("file"));
    const template = data.get("DATA");
    fileRead.onloadend = () => {ws.send(JSON.stringify({endpoint: "submit", value: {template, file: fileRead.result}}))}
    fileRead.onerror = () => {ws.send(JSON.stringify({endpoint: "submit", value: {template, file: fileRead.error}}))}
  });`}));
    }
    if(data.endpoint === "submit"){
      const importer = new Importer([new ErrorReporter(sock)], token);
      if(data.value.template === "T2T"){
        try {
          await importer.parseDataAndPost({data: data.value.file, batch: `[imported] T2T imported on ${new Date().toDateString()}`, source: `TextToTithe`, method: `card`});
        } catch (err) {
          console.error(`Error loading TextToTithe data from file: ${err}`);
        }
      }
      if(data.value.template === "UNI"){
        try {
          await importer.parseDataAndPost({data: data.value.file});
        } catch (err) {
          console.error(`Error loading Universal data from file: ${err}`);
        }
      }
      if(data.value.template === "PP"){
        try {
          await importer.parseDataAndPost({data: data.value.file, batch: `[imported] PayPal imported on ${new Date().toDateString()}`, source: `Paypal`, method: `card`, fund: `general`});
        } catch (err) {
          console.error(`Error loading PayPal data from file: ${err}`);
        }
      }
    }
  };
  sock.onclose = () => console.log("WebSocket has been closed.");
  sock.onerror = (e) => console.error("WebSocket error:", e);
})

function App() {
  return (
    <div class="body">
    <div class="box">
    <h1>PCO Giving Importer</h1>
    <form id="form" name="form" onsubmit="(e) => {e.preventDefault()}" enctype="multipart/form-data">
        <div>
            <h2>
                Template Type:
            </h2>
            <div style="justify-content:left;">
                <input type="radio" id="PP" name="DATA" value="PP" />
                <label for="PP">PayPal</label><br />
                <input type="radio" id="T2T" name="DATA" value="T2T" />
                <label for="T2T">Text 2 tithe</label><br />
                <input type="radio" id="UNI" name="DATA" value="UNI" />
                <label for="UNI">Universal</label><br />
            </div>
        </div>
        <div>
            <h2>
                File:
            </h2>
            <label for="file" class="button">
                Select File
            </label>
            <input type="file" id="file" name="file" accept=".csv, .xlsx" required style="display:none;"/>
            <span id="selected_file_name"></span>
        </div>
        <div>
            <button type="submit" id="submit" class="button">Upload Donations</button>
            <span id="upload_status"></span>
        </div>
    </form>
    </div>
    </div>
  );
}

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener(
  "listen",
  (e) => console.log(`Listening on ${url}:${port}`),
);
await app.listen({ port });

async function getToken(code: string): Promise<Response> {
  const url_auth = new URL("https://api.planningcenteronline.com/oauth/token");
  url_auth.searchParams.append("grant_type", "authorization_code");
  url_auth.searchParams.append("type", "web_server");
  url_auth.searchParams.append("client_id", options.client_id);
  url_auth.searchParams.append("redirect_uri", `${url}/auth/complete`);
  url_auth.searchParams.append("client_secret", options.client_secret);
  url_auth.searchParams.append("code", code);
  return await fetch(url_auth, {
    method: "post",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      "content-type": "application/x-www-form-urlencoded"
    },
  });
}