import { v, vServer } from "vitalize.js";
import fs from 'fs';
let server = new vServer({
    logging: true,
    websocket: {
        enable: false
    }
});

server.init({
    port: process.env.PORT || 3333,
    host: "0.0.0.0",
    cors: true
}, (err, address) => {
    if (err) throw err;
    console.log(`Server active at ${address}`);
})

let Index = new v(("./index.html"), {
    enable_caching: true,
    enable_tailwind: true
});

server.route({
    method: "GET",
    path: "/",
    handler: (request, reply) => {
        Index.renderAll();
        return reply.type("text/html").send(Index.serve());
    }
})

let data = [];

server.route({
    method: "POST",
    path: "/text",
    handler: (request, reply) => {
        let req = JSON.parse(request.body)
        if(data.length == 0) {
            data.push(req);
        }
        data.forEach(page => {
            if (page.pageId == req.pageId) {
                page.title = req.title;
                page.text = req.text;
                page.outline = req.outline;
                page.olCount = req.olCount;
            }else {
                data.push(req);
            }
        })
        fs.writeFileSync("./pages.json", JSON.stringify(data));
        return reply.status(200).send("OK")
    }
})

server.route({
    method: "POST",
    path: "/data",
    handler: (request, reply) => {
        let data;
        let pages = JSON.parse(fs.readFileSync("./pages.json"));
        pages.forEach(page => {
            if (page.pageId == request.body) {
                data = page;
            }
        })
        return reply.send(data);
    }
})

server.route({
    method: "GET",
    path: "/pages",
    handler: (request, reply) => {
        data = JSON.parse(fs.readFileSync("./pages.json"));
        let pages = [];
        data.forEach(obj => {
            pages.push({
                id: obj.pageId,
                title: obj.title
            });
        })
        return reply.send(pages);
    }
})
