/* Teste de fumaca das regras de negocio (roda com banco em memoria). */
process.env.PGLITE_DIR = "memory";
process.env.LIFECYCLE_UNIT = "minutes";
process.env.LIFECYCLE_CONFIRM = "0";
process.env.LIFECYCLE_ARCHIVE = "0";

const { createApp } = await import("../src/server.js");
const { runLifecycle } = await import("../src/services.js");
const app = await createApp();
const server = app.listen(0);
const port = (server.address() as any).port;
const base = `http://localhost:${port}/api`;

let fails = 0;
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "OK  " : "FAIL"} ${msg}`); if (!cond) fails++; };
async function call(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) as any };
}
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const tutor = (await call("POST", "/auth/register", { name: "Tutor", email: "t@x.com", password: "123456", city: "Salvador", uf: "BA" })).json;
const vizinho = (await call("POST", "/auth/register", { name: "Vizinha", email: "v@x.com", password: "123456", city: "salvador", uf: "ba" })).json;
const longe = (await call("POST", "/auth/register", { name: "Longe", email: "l@x.com", password: "123456", city: "Recife", uf: "PE" })).json;
ok(tutor?.token && vizinho?.token, "cadastro e login");

const img = (await call("POST", "/images", { dataUrl: PNG }, tutor.token)).json;
const base_ = { type: "perdido", species: "cao", breed: "SRD", animalName: "Thor", description: "Coleira azul", city: "Salvador", uf: "BA", lat: -12.97, lng: -38.5 };

let r = await call("POST", "/alerts", { ...base_, imageIds: [] }, tutor.token);
ok(r.status === 400 && /foto/.test(r.json.message), "RN01 exige foto");
r = await call("POST", "/alerts", { ...base_, imageIds: [img.id], lat: undefined }, tutor.token);
ok(r.status === 400, "RN01 exige local no mapa");
r = await call("POST", "/alerts", { ...base_, imageIds: [img.id], reward: "x".repeat(81) }, tutor.token);
ok(r.status === 400, "RN08 recompensa ate 80 caracteres");
r = await call("POST", "/alerts", { ...base_, imageIds: [img.id], reward: "R$ 200" });
ok(r.status === 401, "RNF05 publicar exige conta");

r = await call("POST", "/alerts", { ...base_, imageIds: [img.id], reward: "R$ 200" }, tutor.token);
ok(r.status === 201 && r.json.notified === 1, "RF03/RN02 avisa so quem esta na mesma cidade (1 usuario)");
const alertId = r.json.id;
ok(r.json.lat === -12.97 && r.json.approximate === false, "autor ve o ponto exato");

r = await call("POST", "/alerts", { ...base_, imageIds: [img.id] }, tutor.token);
ok(r.status === 409, "RN04 bloqueia alerta duplicado");

const seen = (await call("GET", `/alerts/${alertId}`, undefined, vizinho.token)).json;
const dist = Math.hypot((seen.lat + 12.97) * 111_320, (seen.lng + 38.5) * 108_000);
ok(seen.approximate && dist > 50 && dist < 260, `RN03 ponto aproximado (${dist.toFixed(0)} m)`);
ok(!("email" in seen.author) && !("phone" in seen.author), "alerta nao expoe e-mail nem telefone");

const notifV = (await call("GET", "/notifications", undefined, vizinho.token)).json;
const notifL = (await call("GET", "/notifications", undefined, longe.token)).json;
ok(notifV.unread === 1 && notifL.unread === 0, "notificacao chega a vizinha e nao a outra cidade");

r = await call("GET", "/alerts?city=SALVADOR&uf=ba&type=perdido");
ok(r.status === 401, "RNF05 o mapa e a lista exigem conta");
const list = (await call("GET", "/alerts?city=SALVADOR&uf=ba&type=perdido", undefined, vizinho.token)).json;
ok(list.length === 1, "RF04 lista por cidade (sem diferenciar maiusculas)");

const conv = (await call("POST", "/conversations", { alertId }, vizinho.token)).json;
await call("POST", `/conversations/${conv.id}/messages`, { body: "Vi o Thor na praça!" }, vizinho.token);
const msgs = (await call("GET", `/conversations/${conv.id}/messages`, undefined, tutor.token)).json;
ok(msgs.length === 1 && !msgs[0].mine, "RF08 conversa entre vizinha e tutor");
r = await call("GET", `/conversations/${conv.id}/messages`, undefined, longe.token);
ok(r.status === 404, "terceiro nao le a conversa");

// plaquinha
const pet = (await call("POST", "/pets", { name: "Mel", species: "gato", breed: "SRD", photoId: img.id }, tutor.token)).json;
const tag = (await call("GET", `/tags/${pet.tagCode}`)).json;
ok(tag.name === "Mel" && tag.tagCode === undefined, "RNF03 plaquinha abre sem login e nao expoe o codigo");
r = await call("POST", `/tags/${pet.tagCode}/found`, { lat: -12.9, lng: -38.4, message: "Está comigo" });
ok(r.status === 201, "RF07 quem encontra envia a localizacao sem login");
const scans = (await call("GET", `/pets/${pet.id}/scans`, undefined, tutor.token)).json;
ok(scans.length === 1, "tutor ve a leitura da plaquinha");
r = await call("GET", `/pets/${pet.id}/scans`, undefined, vizinho.token);
ok(r.status === 404, "outra pessoa nao ve as leituras");

// avistado + sou o dono
const img2 = (await call("POST", "/images", { dataUrl: PNG }, vizinho.token)).json;
const seenAlert = (await call("POST", "/alerts", { ...base_, type: "avistado", animalName: null, imageIds: [img2.id], reward: "R$ 50" }, vizinho.token)).json;
ok(seenAlert.reward === null, "RN08 avistado nao tem recompensa");
r = await call("POST", `/alerts/${seenAlert.id}/claim`, {}, vizinho.token);
ok(r.status === 400, "RN09 autor nao pode se declarar dono");
r = await call("POST", `/alerts/${seenAlert.id}/claim`, {}, tutor.token);
ok(r.status === 200 && r.json.conversationId, "RF11 'Sou o dono' abre conversa");

// RN07
r = await call("POST", `/alerts/${alertId}/resolve`, {}, vizinho.token);
ok(r.status === 403, "RN07 so o autor resolve");

// RN05 / RN06 (prazos zerados no teste)
await runLifecycle(true);
let a = (await call("GET", `/alerts/${alertId}`, undefined, tutor.token)).json;
ok(a.confirmationRequestedAt, "RN05 pede confirmacao ao tutor");
await new Promise((res) => setTimeout(res, 50));
await runLifecycle(true);
a = (await call("GET", `/alerts/${alertId}`, undefined, tutor.token)).json;
ok(a.status === "arquivado", "RN06 arquiva sem resposta");
r = await call("POST", `/alerts/${alertId}/reactivate`, {}, tutor.token);
ok(r.status === 200, "RN06 autor reativa");
r = await call("POST", `/alerts/${alertId}/resolve`, {}, tutor.token);
const after = (await call("GET", "/alerts?city=Salvador&uf=BA&type=perdido", undefined, vizinho.token)).json;
ok(r.status === 200 && after.length === 0, "RF10 resolvido sai do mapa");

// buscar e seguir pessoas
r = await call("GET", "/users/search?q=Viz");
ok(r.status === 401, "busca de pessoas exige conta");
r = await call("GET", "/users/search?q=V", undefined, tutor.token);
ok(r.status === 400, "busca exige pelo menos 2 letras");
r = await call("GET", "/users/search?q=viz", undefined, tutor.token);
ok(r.json.length === 1 && r.json[0].name === "Vizinha" && !("email" in r.json[0]), "busca acha pessoa pelo nome, sem expor e-mail");
const vizId = r.json[0].id;
r = await call("GET", "/users/search?q=tut", undefined, tutor.token);
ok(r.json.length === 0, "busca nao devolve a propria pessoa");
r = await call("POST", `/users/${vizId}/follow`, {}, tutor.token);
ok(r.status === 200 && r.json.following === true, "seguir uma pessoa");
await call("POST", `/users/${vizId}/follow`, {}, tutor.token);
const conn = (await call("GET", "/users/connections", undefined, vizinho.token)).json;
ok(conn.followers.length === 1 && conn.followers[0].name === "Tutor" && conn.following.length === 0, "seguidor aparece para quem foi seguido (sem duplicar)");
const nf = (await call("GET", "/notifications", undefined, vizinho.token)).json;
ok(nf.items.filter((n: any) => n.kind === "follow").length === 1, "novo seguidor gera um aviso so");
r = await call("POST", `/users/${tutor.user.id}/follow`, {}, tutor.token);
ok(r.status === 400, "nao da para seguir a si mesmo");
r = await call("POST", "/conversations", { userId: vizId }, tutor.token);
const direct = r.json.id;
r = await call("POST", "/conversations", { userId: vizId }, tutor.token);
ok(direct && r.json.id === direct, "conversa direta e reaproveitada");
r = await call("POST", "/conversations", { userId: tutor.user.id }, tutor.token);
ok(r.status === 400, "nao abre conversa consigo mesmo");
r = await call("DELETE", `/users/${vizId}/follow`, undefined, tutor.token);
ok(r.json.following === false && (await call("GET", "/users/connections", undefined, tutor.token)).json.following.length === 0, "deixar de seguir");

server.close();
console.log(fails ? `\n${fails} falha(s)` : "\nTodas as regras passaram.");
process.exit(fails ? 1 : 0);
