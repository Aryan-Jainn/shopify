const dotenv= require('dotenv');
dotenv.config();
require('isomorphic-fetch');

const Koa = require('koa');
const next = require('next');
const { default: createShopifyAuth }= require('@shopify/koa-shopify-auth');
const { verifyRequest }= require('@shopify/koa-shopify-auth');
const { default: Shopify,ApiVersion }= require('@shopify/shopify-api');
const Router = require("koa-router");


console.log(process.env.SHOPIFY_APP_URL);
Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SHOPIFY_API_SCOPES,
    HOST_NAME: process.env.SHOPIFY_APP_URL.replace(/https:\/\//,""),
    API_VERSION: ApiVersion.October20,
    IS_EMBEDDED_APP: true,
    ESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),

});

const port = parseInt(process.env.PORT, 10) || 80;
const dev = process.env.NODE_ENV !=='production';
const app = next({ dev });
const handle = app.getRequestHandler();

const ACTIVE_SHOPIFY_SHOPS = {};

app.prepare().then(() =>{
    const server = new Koa();
    const router = new Router();
    server.keys = [Shopify.Context.API_SECRET_KEY];
    console.log(process.env.SHOPIFY_APP_URL);
    server.use(
        createShopifyAuth({
            afterAuth(ctx) {
                const { shop, scope } = ctx.state.shopify;
                console.log(shop);
                ACTIVE_SHOPIFY_SHOPS[shop] = scope;
                const redirectUrl = `http://localhost/auth/inline?shop=${shop}&host=${ctx.request.host}`;
                ctx.redirect(redirectUrl);
            }
        }),
    );

    const handleRequest = async (ctx) => {
        await handle(ctx.req, ctx.res);
        ctx.respond = false;
        ctx.res.statusCode = 200;
    };
    
    router.get("/", async (ctx) => {
        const shop = ctx.query.shop;

        if(ACTIVE_SHOPIFY_SHOPS[shop] === undefined){
            ctx.redirect('/auth?shop=${shop}');
        } else{
            await handleRequest(ctx);
        }
    });

    router.get('(.*)', handleRequest);

    router.get("(/_next/static/.*)", handleRequest);
    router.get("/_next/webpack-hmr", handleRequest);
    router.get("(.*)", verifyRequest(), handleRequest);

    server.use(router.allowedMethods());
    server.use(router.routes());

    server.listen(80, () => {
        console.log(`>Ready on http://localhost:${port}`);
    });
}); 
