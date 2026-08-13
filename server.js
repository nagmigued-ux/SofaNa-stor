require("dotenv").config();
const express=require("express"), fs=require("fs"), path=require("path"), helmet=require("helmet"), rateLimit=require("express-rate-limit");
const app=express(); const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,"data");
const read=(f)=>JSON.parse(fs.readFileSync(path.join(DATA,f),"utf8"));
const write=(f,d)=>fs.writeFileSync(path.join(DATA,f),JSON.stringify(d,null,2),"utf8");
app.use(helmet({contentSecurityPolicy:false})); app.use(express.json({limit:"100kb"}));
app.use(rateLimit({windowMs:60*1000,max:120}));
app.use(express.static(path.join(__dirname,"public")));
const adminKey=process.env.ADMIN_KEY||"CHANGE_ME_NOW";

app.get("/api/products",(req,res)=>res.json(read("products.json").filter(x=>x.active)));
app.post("/api/orders",(req,res)=>{
  const {customer,phone,wilaya,address,items,note}=req.body||{};
  if(!customer||!phone||!wilaya||!address||!Array.isArray(items)||!items.length) return res.status(400).json({error:"بيانات الطلب غير مكتملة"});
  const products=read("products.json"); let total=0, safeItems=[];
  for(const it of items){
    const p=products.find(x=>x.id===Number(it.id)&&x.active);
    const qty=Math.max(1,Math.min(20,Number(it.qty)||1));
    if(!p) continue;
    total+=p.price*qty; safeItems.push({id:p.id,name:p.name,price:p.price,qty});
  }
  if(!safeItems.length) return res.status(400).json({error:"لا توجد منتجات صالحة"});
  const orders=read("orders.json");
  const order={id:"SN-"+Date.now(),createdAt:new Date().toISOString(),status:"جديد",customer:String(customer).slice(0,100),phone:String(phone).slice(0,30),wilaya:String(wilaya).slice(0,80),address:String(address).slice(0,250),note:String(note||"").slice(0,300),items:safeItems,total};
  orders.unshift(order); write("orders.json",orders); res.status(201).json({ok:true,orderId:order.id,total});
});
function admin(req,res,next){if(req.headers["x-admin-key"]!==adminKey)return res.status(401).json({error:"غير مصرح"});next()}
app.get("/api/admin/orders",admin,(req,res)=>res.json(read("orders.json")));
app.patch("/api/admin/orders/:id",admin,(req,res)=>{
  const orders=read("orders.json"); const o=orders.find(x=>x.id===req.params.id);
  if(!o)return res.status(404).json({error:"الطلب غير موجود"});
  o.status=String(req.body.status||"جديد").slice(0,40); write("orders.json",orders); res.json(o);
});
app.get("/api/admin/products",admin,(req,res)=>res.json(read("products.json")));
app.post("/api/admin/products",admin,(req,res)=>{
  const {name,category,price,image}=req.body||{}; if(!name||!category||!price)return res.status(400).json({error:"بيانات ناقصة"});
  const ps=read("products.json"); const p={id:Date.now(),name:String(name).slice(0,120),category:String(category).slice(0,50),price:Number(price),image:String(image||"").slice(0,250),active:true}; ps.push(p); write("products.json",ps); res.status(201).json(p);
});
app.patch("/api/admin/products/:id",admin,(req,res)=>{
  const ps=read("products.json"),p=ps.find(x=>x.id===Number(req.params.id)); if(!p)return res.status(404).json({error:"المنتج غير موجود"});
  Object.assign(p,{name:req.body.name??p.name,category:req.body.category??p.category,price:req.body.price??p.price,image:req.body.image??p.image,active:req.body.active??p.active}); write("products.json",ps); res.json(p);
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`SofaNA running on port ${PORT}`));