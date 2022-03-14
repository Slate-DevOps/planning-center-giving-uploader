   
import { h, renderSSR, Component } from "https://deno.land/x/nano_jsx@v0.0.20/mod.ts";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { Importer } from "../importer.ts";
import { Observer, StatusCode, Subject } from "../importerWatcher.ts";

class obsNothing implements Observer {
  update(
    _from: Subject,
    message: string,
    code: StatusCode,
    object?: unknown,
  ): void {
    if(code === StatusCode.error){
      console.log(`Message: ${message}\nCode: ${code}\n`);
      if (object) {
        console.log(object);
      }
    }
  }
}

const options = {
  client_id:'ce8113a7129298f8397d5aaa24317ff75a949a8b87691d6c63500f7143c57b43',
  client_secret: '6a61d8a8927c12e1d838fdee49652a78ae9cb3de7c45b0cd0bc6fe0e4d2dbdf5',
  scopes: 'people+giving', // Scopes limit access for OAuth tokens.
};

const url = 'https://pco-giving-loader.deno.dev';
const port = 4444;
const api_url = 'https://api.planningcenteronline.com/oauth/authorize'

const authUrl = new URL(api_url);
authUrl.searchParams.append("client_id", options.client_id)
authUrl.searchParams.append("redirect_uri", `${url}/auth/complete`);
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
      <script>
        console.log("test")
        //This script can be moved into a seperate file later (github)
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
  console.log("getting form");
  const form = document.getElementById("form");
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    let fileRead = new FileReader();
    const data = new FormData(form);
    const template = data.get("DATA");
    await fileRead.readAsText(data.get("file"));
    fileRead.onloadend = () => {ws.send(JSON.stringify({endpoint: "submit", value: {template, file: fileRead.result}}))}
    fileRead.onerror = () => {ws.send(JSON.stringify({endpoint: "submit", value: {template, file: fileRead.error}}))}
  });`}));
    }
    if(data.endpoint === "submit"){
      const importer = new Importer([new obsNothing()], token);
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
    <form id="form" name="form" onsubmit="(e) => {e.preventDefault()}" enctype="multipart/form-data">
      <div>
        <p>
          Data type:
        </p>
        <input type="radio" id="PP" name="DATA" value="PP" />
        <label for="PP">PayPal</label><br />
        <input type="radio" id="T2T" name="DATA" value="T2T" />
        <label for="T2T">Text 2 tithe</label><br />
        <input type="radio" id="UNI" name="DATA" value="UNI" />
        <label for="UNI">Universal</label><br />
      </div>
      <div>
        <p>
          File:
        </p>
        <input type="file" id="file" name="file" accept=".csv, .xlsx" required />
      </div>
      <div>
        <input type="submit" id="submit" />
      </div>
    </form>
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