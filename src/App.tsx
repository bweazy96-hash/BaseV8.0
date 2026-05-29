// ─────────────────────────────────────────────────────────────────────────────
//  BASE APEX V8.0  —  NETLIFY PRODUCTION BUILD
//  Firebase Firestore live sync · All 10 tabs · Deploy ready
//
//  SETUP:
//  1. npm install firebase
//  2. Firebase config below is already set — no changes needed
//  3. Firebase Console → Firestore → Rules → set:
//       allow read, write: if true;   (tighten before going public)
//  4. netlify deploy --prod
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, setDoc,
} from "firebase/firestore";
// ── FIREBASE ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCazjyRAq4Y8aQZszhT4mT18CzfSl4Sdx0",
  authDomain:        "whole-sale-74a40.firebaseapp.com",
  projectId:         "whole-sale-74a40",
  storageBucket:     "whole-sale-74a40.firebasestorage.app",
  messagingSenderId: "662354746952",
  appId:             "1:662354746952:web:f1f033dddb04711d57427d",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
// ── PALETTE ───────────────────────────────────────────────────────────────────
const T = {
  bg0:"#00040d",bg1:"#000814",bg2:"#010e20",bg3:"#021428",bg4:"#031b34",
  line:"#0a2a4a",line2:"#0d3860",
  cyan:"#00c8ff",cyanL:"#40dfff",cyanD:"#007aaa",
  blue:"#1a6fff",blueL:"#4d8fff",elec:"#00ffe7",
  gold:"#ffb830",goldL:"#ffd060",
  green:"#00e676",greenL:"#40ff90",
  red:"#ff3858",redL:"#ff6080",
  orange:"#ff7830",orangeL:"#ff9850",
  purple:"#8060ff",purpleL:"#a080ff",
  teal:"#00d8c8",tealL:"#20ffe8",
  dim:"#1a3a5c",mid:"#3a6080",
  text:"#7ab0d0",bright:"#b8d8f0",white:"#e8f4ff",
};
const fmt   = (v) => !v||isNaN(v) ? "--" : `$${Math.round(+v).toLocaleString()}`;
const pctS  = (v) => isNaN(v) ? "--" : `${(+v*100).toFixed(1)}%`;
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const uid   = () => Math.random().toString(36).slice(2,9);
function calcDeal(arv,price,repairs,fee=8000,disc=0.70){
  const a=+arv||0,p=+price||0,r=+repairs||0,f=+fee||8000;
  const mao=a*disc-r-f,margin=a>0?(a-p-r)/a:0;
  const spread=p-mao,buyerProfit=a-p-r;
  let grade,gc,verdict,urgency;
  if      (margin>=0.38){grade="A+";gc=T.greenL; verdict="FIRE DEAL";   urgency="MOVE NOW";}
  else if (margin>=0.28){grade="A"; gc=T.green;  verdict="Strong Deal"; urgency="TAKE IT";}
  else if (margin>=0.20){grade="B+";gc=T.goldL;  verdict="Good Deal";   urgency="THINK FAST";}
  else if (margin>=0.14){grade="B"; gc=T.gold;   verdict="Marginal";    urgency="NEGOTIATE";}
  else if (margin>=0.07){grade="C"; gc=T.mid;    verdict="Weak";        urgency="LOW PRI";}
  else                   {grade="D"; gc=T.red;    verdict="No Deal";     urgency="ARCHIVE";}
  return {mao,margin,spread,buyerProfit,grade,gc,verdict,urgency,isProfitable:spread<0};
}
// ── STATIC DATA ───────────────────────────────────────────────────────────────
const STAGES=["New Lead","Attempted Contact","Warm Lead","Follow-Up Needed","Appointment Set","Under Negotiation","Under Contract","Sent To Buyers","Closed","Dead Lead"];
const STAGE_MEANING={"New Lead":"Not contacted","Attempted Contact":"Outreach started","Warm Lead":"Interested","Follow-Up Needed":"Future opportunity","Appointment Set":"Active negotiation","Under Negotiation":"Serious lead","Under Contract":"Secured deal","Sent To Buyers":"Disposition stage","Closed":"Assignment completed","Dead Lead":"Not viable"};
const STAGE_COLORS={"New Lead":T.blue,"Attempted Contact":T.blueL,"Warm Lead":T.teal,"Follow-Up Needed":T.gold,"Appointment Set":T.purple,"Under Negotiation":T.orange,"Under Contract":T.orangeL,"Sent To Buyers":T.purpleL,"Closed":T.green,"Dead Lead":T.red};
const AREAS=["Midtown","Eastside","Westside","Northside","Southside","Suburbs","All Areas"];
const SOURCES=["Zillow","Redfin","Craigslist","Facebook","MLS/Agent","PropStream","DealMachine","Direct Mail","Cold Call","Referral","Other"];
const WEEKLY_KPIS=[
  {id:"calls",  label:"Calls Made",         icon:"CALL",color:T.blue,  target:50},
  {id:"leads",  label:"Leads Generated",    icon:"LEAD",color:T.green, target:15},
  {id:"appts",  label:"Appointments Set",   icon:"APPT",color:T.gold,  target:5},
  {id:"offers", label:"Offers Made",        icon:"OFFR",color:T.orange,target:5},
  {id:"contracts",label:"Contracts Secured",icon:"CNTR",color:T.goldL, target:1},
  {id:"buyers", label:"Buyer Contacts",     icon:"BUYR",color:T.purple,target:10},
  {id:"closed", label:"Closed Deals",       icon:"CLSD",color:T.greenL,target:1},
  {id:"avgfee", label:"Avg Assignment Fee", icon:"FEE", color:T.tealL, target:7500},
];
const IRON_LAWS=[
  {n:1, law:"Never Exceed MAO",             color:T.redL,   detail:"(ARV x 0.70) - Repairs - Fee = MAXIMUM you pay. Not a suggestion."},
  {n:2, law:"Contact Within 24 Hours",      color:T.goldL,  detail:"Every GREEN lead gets a call within 24 hours. Speed is your edge."},
  {n:3, law:"Log Everything Immediately",   color:T.blueL,  detail:"Every call, text, visit goes in the CRM the same day."},
  {n:4, law:"3 Comps Minimum",              color:T.purpleL,detail:"Never calculate ARV from 1 comp. Pull 3 minimum, same zip, same bed/bath."},
  {n:5, law:"Seller Hears Number First",    color:T.orangeL,detail:"Always ask what number they need first. Anchor AFTER you know their floor."},
  {n:6, law:"Never Send Earnest to Seller", color:T.redL,   detail:"Earnest money goes to title/escrow only. Never directly to the seller."},
  {n:7, law:"'And/Or Assigns' Every Time",  color:T.goldL,  detail:"Every contract must include 'and/or assigns'. No exceptions."},
  {n:8, law:"Proof of Funds Before Address",color:T.greenL, detail:"No buyer gets the address until POF is verified. Non-negotiable."},
  {n:9, law:"Follow Up 5x Before Dead",     color:T.blueL,  detail:"Most deals close on the 3rd-5th follow up. Don't quit early."},
  {n:10,law:"Close in 21 Days or Less",     color:T.purpleL,detail:"Speed is leverage. Operators who close fast get repeat sellers."},
  {n:11,law:"3 Contractor Bids Always",     color:T.orangeL,detail:"Never use seller's estimate. Get 3 bids from your contractors."},
  {n:12,law:"10+ Buyers Every Deal",        color:T.greenL, detail:"Blast every deal to 10+ buyers simultaneously. More eyes = faster close."},
];
const ALL_SCRIPTS=[
  {role:"ACQ",  color:T.gold,  title:"Cold Call Opener",         body:"Hi, is this [NAME]? My name is [YOUR NAME] — I'm a local real estate investor. I noticed your property at [ADDRESS] and wanted to see if you'd ever consider a cash offer? No pressure, just exploring options."},
  {role:"ACQ",  color:T.gold,  title:"4 Qualification Questions",body:"1. \"What's the situation — is it vacant or are you living there?\"\n2. \"How soon are you looking to close if you had the right offer?\"\n3. \"Have you done any repairs recently, or does it need work?\"\n4. \"What price would make this a no-brainer for you?\""},
  {role:"ACQ",  color:T.gold,  title:"Making the Offer",         body:"Based on the condition and values in the area, I can offer [MAO-10%] cash, close in [14-21] days, no repairs, no commissions. I know that might be lower than you hoped, but that speed and certainty has real value. Does that work?"},
  {role:"ACQ",  color:T.gold,  title:"Handling I Want More",     body:"I understand completely. Here's my challenge — I have to account for repairs, holding costs, and my margin to make numbers work. If I could get you to [SLIGHTLY HIGHER], would that get us to a yes today?"},
  {role:"ACQ",  color:T.gold,  title:"Locking the Contract",     body:"Perfect — I'll send a simple purchase agreement within the hour. Just sign and we move forward. My title company handles everything from there. Does [EMAIL] work?"},
  {role:"OPS",  color:T.cyanL, title:"Buyer Blast Text",         body:"NEW DEAL — [AREA], TUCSON\nARV: $[X] | Asking: $[Y] | Repairs: $[Z]\nEquity: $[SPREAD] | Grade: [GRADE]\nPOF required for address. Reply YES for full details."},
  {role:"OPS",  color:T.cyanL, title:"Investor Outreach",        body:"Hey [NAME], I have a new deal in [AREA] — ARV around $[X], asking $[Y]. Solid spread after repairs. Want the full breakdown? Just need quick POF confirmation first."},
  {role:"OPS",  color:T.cyanL, title:"Follow-Up Sequence",       body:"Day 1: Call (opener script)\nDay 3: Text — \"Hey [NAME], following up on [ADDRESS]. Still interested?\"\nDay 7: Call again\nDay 14: Text — \"Last check-in on [ADDRESS]. Offer still open.\"\nDay 30: Final — \"Keeping your info for future. Call anytime.\""},
  {role:"TITLE",color:T.purple,title:"Title Company Intro",      body:"Subject: New Investor Account — [YOUR NAME]\n\nHi [TITLE REP], I'm a local wholesaler closing [X] deals/month in the Tucson market. Looking to establish a relationship for double-closes and assignments. Can we do 15 min this week?"},
];
const PARTNERS={
  acq:{name:"Partner 1 - Acquisitions",short:"Acq",mission:"Secure opportunities.",color:T.gold, icon:"ACQ",responsibilities:["Seller calls","Lead qualification","Negotiations","Appointments","Relationship building","Offers","Contract execution","Seller follow-up"]},
  ops:{name:"Partner 2 - Operations / CRM",short:"Ops",mission:"Build and maintain the machine.",color:T.cyanL,icon:"OPS",responsibilities:["CRM management","Lead tracking","Data entry","Follow-up scheduling","Buyer outreach","Comps & MAO","Title coordination","KPI reporting"]},
};
const DAILY_PHASES=[
  {phase:"MORNING",label:"Planning Phase", color:T.gold,  tasks:["Review pipeline","Review follow-ups","Review hot leads","Review appointments","Identify today's top 3 targets"]},
  {phase:"MIDDAY", label:"Execution Phase",color:T.orange,acqFocus:["Outbound calls","Inbound lead handling","Negotiations","Appointments","Relationship maintenance"],opsFocus:["CRM updates","Pulling comps","Calculating MAO","Organizing buyer lists","Scheduling follow-ups"]},
  {phase:"EVENING",label:"Review Phase",   color:T.purple,tasks:["Review new leads","Update statuses","Discuss problem deals","Review KPI numbers","Plan tomorrow's priorities"]},
];
const LEAD_SITES=[
  {cat:"MLS & Listings",color:T.cyan,icon:"MLS",sites:[
    {name:"Zillow",url:"https://zillow.com",desc:"Filter FSBO, price drops, days on market. Best for motivated seller signals.",tip:"Use 'Days on Zillow 90+' + price reductions = distressed sellers"},
    {name:"Redfin",url:"https://redfin.com",desc:"MLS data with hot/warm/cool indicators. Great for accurate comp pulling.",tip:"'Hot Homes' shows demand. Inverse = slow movers worth calling"},
    {name:"Realtor.com",url:"https://realtor.com",desc:"Full MLS access, open house schedules, foreclosure listings.",tip:"Filter 'Reduced Price' + 'For Sale By Owner' simultaneously"},
    {name:"MLS.com",url:"https://mls.com",desc:"Direct MLS portal aggregator. Good for off-market pocket listings.",tip:"Agent-listed properties sitting 60+ days are negotiable"},
  ]},
  {cat:"Distressed & Off-Market",color:T.gold,icon:"OFF",sites:[
    {name:"PropStream",url:"https://propstream.com",desc:"#1 tool for wholesalers. Skip trace, absentee owners, pre-foreclosures, tax delinquent.",tip:"Stack: Absentee Owner + Equity 40%+ + Tax Delinquent = gold"},
    {name:"DealMachine",url:"https://dealmachine.com",desc:"Drive for dollars app with built-in skip tracing and direct mail campaigns.",tip:"Drive target neighborhoods, tag vacant properties, auto-mail same day"},
    {name:"ATTOM Data",url:"https://attomdata.com",desc:"Property data, foreclosure filings, distressed property lists by zip.",tip:"Pull pre-foreclosure lists 60-90 days before auction date"},
    {name:"ListSource",url:"https://listsource.com",desc:"Build hyper-targeted mail lists by equity %, ownership length, property type.",tip:"High equity + owned 10+ years = likely motivated to sell"},
  ]},
  {cat:"Foreclosure & Auctions",color:T.orange,icon:"AUC",sites:[
    {name:"Foreclosure.com",url:"https://foreclosure.com",desc:"Pre-foreclosures, REOs, sheriff sales, tax liens nationwide.",tip:"Contact pre-foreclosure owners 30-60 days before sale date"},
    {name:"Auction.com",url:"https://auction.com",desc:"Largest online real estate auction platform. Trustee and bank-owned sales.",tip:"Set max bid at 65% ARV to leave spread for your buyer"},
    {name:"Hubzu",url:"https://hubzu.com",desc:"Bank-owned and pre-foreclosure auction site. Less competition than Auction.com.",tip:"Check bid history to understand true market demand"},
    {name:"RealtyTrac",url:"https://realtytrac.com",desc:"Foreclosure filings, sheriff sales, and bank-owned properties.",tip:"Use foreclosure map view to find distressed neighborhoods"},
  ]},
  {cat:"Social & Community",color:T.purple,icon:"SOC",sites:[
    {name:"Facebook Marketplace",url:"https://facebook.com/marketplace",desc:"FSBO listings, estate sales, owners posting directly. Low competition.",tip:"Search 'house' + 'cash' + your city. Message within minutes of posting"},
    {name:"Craigslist",url:"https://craigslist.org",desc:"Old school but still active. Real sellers who want fast, private deals.",tip:"Search 'by owner' in housing section. Respond same day"},
    {name:"BiggerPockets",url:"https://biggerpockets.com",desc:"Investor community, off-market deal sharing, buyer/seller marketplace.",tip:"Post in your local forum asking for off-market deals or motivated sellers"},
    {name:"Connected Investors",url:"https://connectedinvestors.com",desc:"Wholesale deal marketplace and investor network.",tip:"Post your deals AND find deals from other wholesalers to double-close"},
  ]},
  {cat:"Public Records & Tax",color:T.teal,icon:"GOV",sites:[
    {name:"County Assessor",url:"https://www.assessor.pima.gov",desc:"Pima County assessor for owner info, assessed values, property history.",tip:"Cross-reference with PropStream. Assess equity from purchase price vs market"},
    {name:"PACER (Bankruptcies)",url:"https://pacer.gov",desc:"Federal bankruptcy filings. Sellers in Chapter 7/13 often need quick sales.",tip:"Cross-reference addresses with your market area"},
    {name:"Netronline",url:"https://publicrecords.netronline.com",desc:"Links to all county public records by state. Free property lookups.",tip:"Find owner name and mailing address for any property nationwide"},
    {name:"PropertyShark",url:"https://propertyshark.com",desc:"Ownership history, foreclosure auctions, comps, tax info in one place.",tip:"Great for pulling comp history going back 5-10 years"},
  ]},
];
const BASE_CONTRACTOR_WORK=[
  {id:"roof",    name:"Roof Replacement",      icon:" ",unit:"per sq ft", low:3.80, mid:5.50, high:8.20, desc:"Full tear-off and replace, asphalt shingles. Metal/tile adds 40-80%."},
  {id:"hvac",    name:"HVAC System (3-ton)",   icon:" ",unit:"per unit",  low:4200, mid:6800, high:11500,desc:"Full HVAC install including air handler, condenser, and ductwork connections."},
  {id:"elec",    name:"Electrical Panel",      icon:" ",unit:"per panel", low:1800, mid:2800, high:4500, desc:"200-amp panel upgrade. Full rewire of home is 3-5x this cost."},
  {id:"plumb",   name:"Plumbing (Full Repipe)",icon:" ",unit:"per house", low:4500, mid:7200, high:12000,desc:"Whole-home copper or PEX repipe, 3/2 home. Spot repairs much less."},
  {id:"kitchen", name:"Kitchen Remodel",       icon:" ",unit:"per project",low:8500,mid:18000,high:42000,desc:"Cabinets, countertops, appliances, flooring, fixtures. Cosmetic only is 40% less."},
  {id:"bath",    name:"Bathroom Remodel",      icon:" ",unit:"per bath",  low:4200, mid:8500, high:18000,desc:"Full gut and redo. Vanity, tile, toilet, fixtures, drywall."},
  {id:"floor",   name:"Flooring (LVP/Tile)",   icon:" ",unit:"per sq ft", low:2.80, mid:4.50, high:7.50, desc:"LVP installation with prep. Tile adds $2-4/sqft. Hardwood is $8-14."},
  {id:"drywall", name:"Drywall (Full Room)",   icon:" ",unit:"per sq ft", low:1.80, mid:3.00, high:5.00, desc:"Hang, tape, mud, texture, prime. Does not include paint."},
  {id:"paint",   name:"Interior Paint",        icon:" ",unit:"per sq ft", low:1.20, mid:2.00, high:3.50, desc:"Walls and ceilings, 2-coat. Includes primer. Trim adds 30%."},
  {id:"windows", name:"Window Replacement",    icon:" ",unit:"per window",low:280,  mid:550,  high:1100, desc:"Standard double-pane vinyl replacement. Labor included."},
  {id:"doors",   name:"Interior Doors",        icon:" ",unit:"per door",  low:180,  mid:320,  high:650,  desc:"Prehung hollow core install. Solid core adds 40-60%."},
  {id:"foundation",name:"Foundation Repair",  icon:" ",unit:"per pier",  low:800,  mid:1500, high:3200, desc:"Per pier for push or helical piers. Full foundation jobs 15-50+ piers."},
  {id:"demo",    name:"Demo & Hauling",        icon:" ",unit:"per room",  low:400,  mid:850,  high:1800, desc:"Full room demo, dumpster, haul-away. Add 20% for hazmat (asbestos/lead)."},
  {id:"landscape",name:"Landscaping",         icon:" ",unit:"per project",low:800, mid:2200, high:6500, desc:"Cleanup, gravel/sod, basic plants, curb appeal package."},
  {id:"garage",  name:"Garage Door",          icon:" ",unit:"per door",  low:850,  mid:1400, high:2800, desc:"Standard single-car replacement. Double door add 50%. Opener included."},
];
const ZIP_REGIONS=[
  {prefixes:["850","851","852","853","854","855"],label:"Phoenix Metro, AZ",         mult:1.05,note:"High labor demand, fast-growing market"},
  {prefixes:["857","856"],                        label:"Tucson, AZ",                mult:0.92,note:"Below national avg, competitive contractor market"},
  {prefixes:["860","863"],                        label:"Flagstaff/Prescott, AZ",    mult:1.08,note:"Mountain region premium, seasonal availability"},
  {prefixes:["900","901","902","903","904","905"],label:"Los Angeles, CA",            mult:1.65,note:"Very high COL, union labor, permit costs"},
  {prefixes:["940","941","942","943","944"],       label:"San Francisco Bay Area, CA",mult:1.90,note:"Highest in US, severe labor shortage"},
  {prefixes:["920","921","922"],                   label:"San Diego, CA",             mult:1.50,note:"High demand, limited contractor availability"},
  {prefixes:["910","911","912","913","914","915"],label:"LA Suburbs (Inland Empire), CA",mult:1.35,note:"Moderate vs coastal CA, still above national avg"},
  {prefixes:["958","959","960"],                   label:"Sacramento, CA",            mult:1.28,note:"Growing market, moderate premium"},
  {prefixes:["733","734","735"],                   label:"Houston, TX",               mult:0.98,note:"Near national avg, good contractor supply"},
  {prefixes:["750","751","752","753","754","755"],label:"Dallas/Fort Worth, TX",      mult:1.05,note:"Booming market, slightly above avg"},
  {prefixes:["786","787","788"],                   label:"Austin, TX",                mult:1.20,note:"Tech boom inflated costs, rising fast"},
  {prefixes:["780","781","782"],                   label:"San Antonio, TX",           mult:0.90,note:"Most affordable major TX metro"},
  {prefixes:["331","332","333"],                   label:"Miami/Broward, FL",         mult:1.30,note:"High demand, hurricane-code requirements"},
  {prefixes:["328","327","326"],                   label:"Orlando, FL",               mult:1.05,note:"Moderate, growing market"},
  {prefixes:["336","337"],                         label:"Tampa/St. Pete, FL",        mult:1.10,note:"Competitive market, seasonal spikes"},
  {prefixes:["322","323","324"],                   label:"Jacksonville/Tallahassee, FL",mult:0.95,note:"Below state avg, good value"},
  {prefixes:["891","892","893","894","895"],       label:"Las Vegas, NV",             mult:1.10,note:"Fast growth, moderate premium"},
  {prefixes:["800","801","802","803"],             label:"Denver/Boulder, CO",        mult:1.25,note:"High altitude premium, booming market"},
  {prefixes:["809","810","811","812"],             label:"Colorado Springs, CO",      mult:1.10,note:"Military market, moderate costs"},
  {prefixes:["300","301","302","303","304","305"],label:"Atlanta, GA",                mult:1.08,note:"Moderate premium, good contractor supply"},
  {prefixes:["314","315","316"],                   label:"Savannah/Augusta, GA",      mult:0.88,note:"Below avg, good margins for investors"},
  {prefixes:["272","273","274","275","276","277"],label:"Raleigh/Durham, NC",         mult:1.12,note:"Tech growth driving costs up"},
  {prefixes:["280","281","282"],                   label:"Charlotte, NC",             mult:1.05,note:"Banking hub, moderate costs"},
  {prefixes:["370","371","372","373","374"],       label:"Nashville, TN",             mult:1.15,note:"Hottest midwest market, costs rising fast"},
  {prefixes:["380","381","382","383","384"],       label:"Memphis, TN",               mult:0.85,note:"One of lowest cost markets in US"},
  {prefixes:["430","431","432","433","434","435"],label:"Columbus, OH",               mult:0.95,note:"Stable market, near national avg"},
  {prefixes:["440","441","442","443","444","445"],label:"Cleveland/Akron, OH",        mult:0.88,note:"Rust belt, very affordable labor"},
  {prefixes:["606","607","608"],                   label:"Chicago, IL",               mult:1.30,note:"Union labor, high permit costs"},
  {prefixes:["100","101","102","103","104"],       label:"New York City, NY",         mult:2.10,note:"Highest labor costs in US"},
  {prefixes:["110","111","112","113","114","115"],label:"Long Island, NY",            mult:1.70,note:"Extremely high COL, union labor"},
  {prefixes:["120","121","122","123","124"],       label:"Upstate New York",          mult:1.10,note:"Moderate vs NYC, seasonal availability"},
  {prefixes:["480","481","482","483","484","485"],label:"Detroit Metro, MI",          mult:0.82,note:"Very affordable, large contractor supply"},
  {prefixes:["190","191","192"],                   label:"Philadelphia, PA",          mult:1.25,note:"Union influence, high permit fees"},
  {prefixes:["150","151","152"],                   label:"Pittsburgh, PA",            mult:1.00,note:"At national average"},
  {prefixes:["*"],                                 label:"National Average",          mult:1.00,note:"Baseline 2026 national contractor pricing"},
];
const TABS=[
  {id:"command",label:"Command"},{id:"team",label:"Team"},
  {id:"deals",label:"Deals"},{id:"pipeline",label:"Pipeline"},
  {id:"calc",label:"Calc"},{id:"people",label:"Buyers"},
  {id:"scripts",label:"Scripts"},{id:"sites",label:"Sites"},
  {id:"pricing",label:"Pricing"},{id:"sop",label:"SOP"},
];
// ── SHARED UI ─────────────────────────────────────────────────────────────────
const GradeChip=({grade,color,size=14})=>(
  <div style={{width:size+16,height:size+16,borderRadius:5,background:`${color}18`,border:`1.5px solid ${color}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size-2,fontWeight:900,color,fontFamily:"monospace",flexShrink:0,boxShadow:`0 0 10px ${color}30`}}>{grade}</div>
);
const Tag=({color,children})=>(
  <span style={{background:`${color}15`,border:`1px solid ${color}40`,color,borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700,letterSpacing:0.5}}>{children}</span>
);
const SecHead=({children,color=T.cyan})=>(
  <div style={{fontSize:9,letterSpacing:2.5,color,textTransform:"uppercase",marginBottom:8,fontWeight:800,display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:12,height:1,background:`${color}80`}}/>{children}
    <div style={{flex:1,height:1,background:`${color}20`}}/>
  </div>
);
const Panel=({children,glow,style={}})=>(
  <div style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${glow?glow+"40":T.line}`,borderRadius:10,padding:"12px 13px",marginBottom:8,boxShadow:glow?`0 0 20px ${glow}15`:`0 2px 12px #00000060`,...style}}>{children}</div>
);
const TX={
  h1:{fontSize:16,fontWeight:900,color:T.white,letterSpacing:0.5},
  h2:{fontSize:13,fontWeight:800,color:T.bright},
  h3:{fontSize:11,fontWeight:700,color:T.bright},
  body:{fontSize:11,fontWeight:600,color:T.text,lineHeight:1.6},
  label:{fontSize:9,fontWeight:700,color:T.text,letterSpacing:1,textTransform:"uppercase"},
  dim:{fontSize:9,fontWeight:600,color:T.mid},
};
const NInput=({label,val,onChange,prefix,type="number",ph})=>(
  <div>
    {label&&<div style={{...TX.label,marginBottom:4}}>{label}</div>}
    <div style={{position:"relative"}}>
      {prefix&&<span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.cyan,fontSize:11,fontWeight:700}}>{prefix}</span>}
      <input type={type} value={val} placeholder={ph||""} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",boxSizing:"border-box",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,fontWeight:600,padding:prefix?"7px 8px 7px 22px":"7px 10px",outline:"none",fontFamily:"monospace"}}/>
    </div>
  </div>
);
const NSel=({label,val,onChange,opts})=>(
  <div>
    {label&&<div style={{...TX.label,marginBottom:4}}>{label}</div>}
    <select value={val} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace",fontWeight:600}}>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
function useToast(){
  const [toasts,setToasts]=useState([]);
  const push=(msg,type="info")=>{
    const id=uid();
    setToasts(p=>[{id,msg,type},...p.slice(0,4)]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4500);
  };
  return {toasts,push};
}
// ── COMMAND TAB ───────────────────────────────────────────────────────────────
function CommandTab({deals,kpiVals,setKpiVals}){
  const closed=deals.filter(d=>d.stage==="Closed");
  const hot=deals.filter(d=>["A+","A"].includes(calcDeal(d.arv,d.price,d.repairs).grade));
  const earned=closed.reduce((s,d)=>s+(+d.estimatedFee||0),0);
  const followUp=deals.filter(d=>d.nextFollowUp&&d.nextFollowUp<=Date.now()&&!["Closed","Dead Lead"].includes(d.stage));
  function incrKpi(id,delta){
    const next=Math.max(0,(kpiVals[id]||0)+delta);
  }
    setDoc(doc(db,"kpis","weekly"),{...kpiVals,[id]:next},{merge:true});
  return(
 LIVE - {deals.length} DEALS 
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      <div style={{background:`linear-gradient(135deg,${T.bg1},${T.bg3})`,border:`1px solid ${T.cyan}30`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 80% 50%,${T.cyan}08 0%,transparent 60%)`,pointerEvents:"none"}}/>
        <div style={{...TX.h1,fontSize:15,color:T.cyan,textShadow:`0 0 15px ${T.cyan}80`}}>APEX Wholesale Machine</div>
        <div style={{...TX.body,marginTop:5}}>Find · Lock · Assign · Collect · Repeat</div>
        <div style={{...TX.body,marginTop:4,color:T.greenL,fontWeight:800}}>
      </div>
      {followUp.length>0&&(
        <Panel style={{border:`1px solid ${T.goldL}44`}}>
          <SecHead color={T.goldL}>Follow-Ups Due Today ({followUp.length})</SecHead>
          {followUp.map(d=>(
            <div key={d.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 9px",background:`${T.gold}08`,borderRadius:6,border:`1px solid ${T.gold}25`,marginBottom:5}}>
              <div><div style={{...TX.h3}}>{d.address}</div><div style={{...TX.dim,marginTop:2}}>{d.sellerName} 
              <Tag color={T.goldL}>Follow Up</Tag>
            </div>
          ))}
        </Panel>
      )}
      <Panel>
        <SecHead>Live KPI Snapshot</SecHead>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {[
            {l:"Total Deals",v:deals.length,c:T.cyan},
            {l:"Active",v:deals.filter(d=>!["Closed","Dead Lead"].includes(d.stage)).length,c:T.blueL},
            {l:"Closed",v:closed.length,c:T.greenL},
            {l:"Hot Deals",v:hot.length,c:hot.length>0?T.redL:T.dim},
          ].map(({l,v,c})=>(
            <div key={l} style={{background:T.bg1,border:`1px solid ${c}30`,borderRadius:8,padding:"9px 8px",textAlign:"center"}}>
              <div style={{...TX.label,marginBottom:3,color:T.mid}}>{l}</div>
              <div style={{fontSize:20,fontWeight:900,color:c,fontFamily:"monospace",textShadow:`0 0 10px ${c}60`}}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SecHead>Weekly KPI Tracker — Live Synced</SecHead>
        {WEEKLY_KPIS.map((kpi,i)=>{
          const val=kpiVals[kpi.id]||0,pct=clamp(val/kpi.target,0,1),done=val>=kpi.target;
          return(
            <div key={i} style={{background:done?`${kpi.color}0d`:T.bg1,border:`1px solid ${done?kpi.color+"40":T.line}`,borderRadius:7,padding:"8px 10px",marginBottom:5}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{fontSize:8,color:kpi.color,fontWeight:900,width:32,flexShrink:0}}>{kpi.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{...TX.h3,color:done?kpi.color:T.bright}}>{kpi.label}</span>
                    <span style={{fontSize:11,color:kpi.color,fontFamily:"monospace",fontWeight:900}}>{val}/{kpi.target}</span>
                  </div>
                  <div style={{background:T.bg0,borderRadius:3,height:4,overflow:"hidden"}}>
                    <div style={{width:`${pct*100}%`,height:"100%",background:`linear-gradient(90deg,${kpi.color}80,${kpi.color})`,borderRadius:3,transition:"width 0.3s"}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <button onClick={()=>incrKpi(kpi.id,-1)} style={{background:T.bg0,border:`1px solid ${T.line}`,borderRadius:4,color:T.mid,width:22,height:22,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>-</button>
                  <button onClick={()=>incrKpi(kpi.id,+1)} style={{background:`${kpi.color}20`,border:`1px solid ${kpi.color}50`,borderRadius:4,color:kpi.color,width:22,height:22,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>+</button>
                </div>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
// ── TEAM TAB ──────────────────────────────────────────────────────────────────
function TeamTab(){
  const [activePhase,setActivePhase]=useState(0);
  const [dailyChecks,setDailyChecks]=useState({});
  return(
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      {Object.entries(PARTNERS).map(([key,p])=>(
        <Panel key={key} glow={p.color}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:9,background:`${p.color}20`,border:`1.5px solid ${p.color}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:p.color}}>{p.icon}</div>
            <div><div style={{...TX.h1,color:p.color}}>{p.name}</div><div style={{...TX.body,marginTop:2}}>Mission: {p.mission}</div></div>
          </div>
          <SecHead color={p.color}>Responsibilities</SecHead>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {p.responsibilities.map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:7,background:`${p.color}08`,border:`1px solid ${p.color}20`,borderRadius:6,padding:"5px 8px"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:p.color}}/><span style={{...TX.body,fontSize:10}}>{r}</span>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      <Panel>
        <SecHead>Daily Structure</SecHead>
        <div style={{display:"flex",gap:5,marginBottom:10}}>
          {DAILY_PHASES.map((ph,i)=>(
            <button key={i} onClick={()=>setActivePhase(i)} style={{flex:1,background:activePhase===i?`${ph.color}20`:"none",border:`1px solid ${activePhase===i?ph.color+"60":T.line}`,borderRadius:7,padding:"7px 4px",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:8,color:activePhase===i?ph.color:T.mid,fontWeight:900,letterSpacing:1}}>{ph.phase}</div>
              <div style={{fontSize:7,color:T.mid,marginTop:2}}>{ph.label}</div>
            </button>
          ))}
        </div>
        {(()=>{const ph=DAILY_PHASES[activePhase];return(
          <div style={{background:`${ph.color}08`,border:`1px solid ${ph.color}30`,borderRadius:8,padding:12}}>
            <div style={{...TX.h2,color:ph.color,marginBottom:8}}>{ph.phase} · {ph.label}</div>
            {ph.tasks&&ph.tasks.map((t,i)=><div key={i} style={{display:"flex",gap:7,marginBottom:4}}><div style={{color:ph.color,fontWeight:900}}>›</div><div style={{...TX.body}}>{t}</div></div>)}
            {ph.acqFocus&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
              <div style={{background:`${T.gold}10`,border:`1px solid ${T.gold}30`,borderRadius:7,padding:10}}><div style={{...TX.label,color:T.gold,marginBottom:6}}>Acquisitions</div>{ph.acqFocus.map((f,i)=><div key={i} style={{...TX.body,fontSize:10,marginBottom:2}}>
              <div style={{background:`${T.cyanL}10`,border:`1px solid ${T.cyanL}30`,borderRadius:7,padding:10}}><div style={{...TX.label,color:T.cyanL,marginBottom:6}}>Operations</div>{ph.opsFocus.map((f,i)=><div key={i} style={{...TX.body,fontSize:10,marginBottom:2}}>
            </div>)}
          </div>
        );})()}
      </Panel>
      <Panel>
        <SecHead>Daily Checklist</SecHead>
        {["Review pipeline together","Review all follow-ups due today","Identify today's top 3 targets","Confirm appointments set","Review last 24h CRM updates","Set tomorrow's priorities"].map((item,i)=>{
          const done=dailyChecks[i];
          return(<div key={i} onClick={()=>setDailyChecks(p=>({...p,[i]:!p[i]}))} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",marginBottom:4,background:done?`${T.green}08`:T.bg1,border:`1px solid ${done?T.green+"40":T.line}`,borderRadius:7,cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{width:18,height:18,borderRadius:4,flexShrink:0,border:`1.5px solid ${done?T.green:T.line2}`,background:done?`${T.green}30`:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.green}}>{done?"
            <div style={{...TX.body,color:done?T.greenL:T.bright,textDecoration:done?"line-through":"none"}}>{item}</div>
          </div>);
        })}
      </Panel>
    </div>
  );
}
// ── DEALS TAB ─────────────────────────────────────────────────────────────────
function DealsTab({deals,push}){
  const [dealFilter,setDealFilter]=useState("all");
  const [areaFilter,setAreaFilter]=useState("All Areas");
  const [selectedDeal,setSelectedDeal]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const emptyF={address:"",arv:"",price:"",repairs:"",source:"Zillow",area:"Midtown",stage:"New Lead",staff:"Acq",sellerName:"",sellerPhone:"",notes:"",estimatedFee:""};
  const [form,setForm]=useState(emptyF);
  const followUpDue=deals.filter(d=>d.nextFollowUp&&d.nextFollowUp<=Date.now()&&!["Closed","Dead Lead"].includes(d.stage));
  const dupCheck=form.address.length>8&&!editId?deals.find(d=>{
    const nA=form.address.toLowerCase().replace(/[^a-z0-9]/g,"");
    const nB=(d.address||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    return nA.slice(0,14)===nB.slice(0,14);
  }):null;
  const filtered=deals.filter(d=>{
    const g=calcDeal(d.arv,d.price,d.repairs);
    if(dealFilter==="hot"&&!["A+","A"].includes(g.grade))return false;
    if(dealFilter==="starred"&&!d.starred)return false;
    if(dealFilter==="followup"&&!followUpDue.find(x=>x.id===d.id))return false;
    if(areaFilter!=="All Areas"&&d.area!==areaFilter)return false;
    return true;
  });
  async function submitDeal(){
    if(!form.address||!form.arv||!form.price){push("Need Address, ARV, and Price","error");return;}
    if(dupCheck&&!editId){push("Duplicate address — fix or edit existing deal","error");return;}
    const g=calcDeal(form.arv,form.price,form.repairs);
    const payload={...form,arv:+form.arv,price:+form.price,repairs:+form.repairs||0,estimatedFee:+form.estimatedFee||0,ts:Date.now()};
    if(editId){
      await updateDoc(doc(db,"deals",editId),payload);
      push(`Deal updated · Grade ${g.grade}`);
    }else{
      const leadId=`L-${String(deals.length+1).padStart(3,"0")}`;
      await addDoc(collection(db,"deals"),{...payload,leadId,starred:false});
      push(`Deal added · Grade ${g.grade}`);
    }
    setShowForm(false);setEditId(null);setForm(emptyF);
  }
  async function deleteDeal(id){await deleteDoc(doc(db,"deals",id));setSelectedDeal(null);push("Deal removed");}
  async function advanceStage(id){
    const deal=deals.find(d=>d.id===id);if(!deal)return;
    const ns=STAGES[Math.min(STAGES.indexOf(deal.stage)+1,STAGES.length-1)];
    await updateDoc(doc(db,"deals",id),{stage:ns});
    if(ns==="Closed")push(" CLOSED! Collect your check!","alert");
  }
  async function toggleStar(id,current){await updateDoc(doc(db,"deals",id),{starred:!current});}
  const selDeal=selectedDeal?deals.find(d=>d.id===selectedDeal):null;
  const selGrade=selDeal?calcDeal(selDeal.arv,selDeal.price,selDeal.repairs):null;
  return(
    <div>
      <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        {[{id:"all",label:"All"},{id:"hot",label:"Hot "},{id:"starred",label:" Starred"},{id:"followup",label:"Follow-Up"}].map(f=>(
          <button key={f.id} onClick={()=>setDealFilter(f.id)} style={{background:dealFilter===f.id?`${T.cyan}20`:"none",border:`1px solid ${dealFilter===f.id?T.cyan+"60":T.line}`,borderRadius:5,color:dealFilter===f.id?T.cyan:T.mid,fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",transition:"all 0.15s"}}>{f.label}</button>
        ))}
        <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)} style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:5,color:T.text,fontSize:9,padding:"4px 8px",marginLeft:"auto"}}>
          {AREAS.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {filtered.length===0&&<div style={{textAlign:"center",padding:"30px",color:T.mid,fontSize:11}}>No deals in this filter</div>}
</span>}
      {filtered.map(deal=>{
        const g=calcDeal(deal.arv,deal.price,deal.repairs),sc=STAGE_COLORS[deal.stage]||T.mid;
        return(
          <div key={deal.id} style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${sc}30`,borderRadius:9,padding:"10px 11px",marginBottom:7,cursor:"pointer"}} onClick={()=>setSelectedDeal(selectedDeal===deal.id?null:deal.id)}>
            <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
              <GradeChip grade={g.grade} color={g.gc} size={15}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:8,color:T.cyan,fontFamily:"monospace",fontWeight:700}}>{deal.leadId}</span>
                  <div style={{...TX.h3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.address}</div>
                  {deal.starred&&<span style={{color:T.goldL}}>
                </div>
                {deal.sellerName&&<div style={{fontSize:10,color:T.blueL,fontWeight:700,marginBottom:3}}>{deal.sellerName}</div>}
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                  <Tag color={sc}>{deal.stage}</Tag><Tag color={T.purple}>{deal.area}</Tag><Tag color={deal.staff==="Acq"?T.gold:T.cyanL}>{deal.staff}</Tag>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                  {[{l:"ARV",v:fmt(deal.arv),c:T.blueL},{l:"Price",v:fmt(deal.price),c:T.cyan},{l:"Margin",v:pctS(g.margin),c:g.gc},{l:"MAO",v:fmt(g.mao),c:T.gold}].map(({l,v,c})=>(
                    <div key={l} style={{background:T.bg0,borderRadius:5,padding:"4px 6px",border:`1px solid ${T.line}`}}>
                      <div style={{...TX.dim,marginBottom:1}}>{l}</div>
                      <div style={{fontSize:10,fontWeight:800,color:c,fontFamily:"monospace"}}>{v}</div>
                    </div>
                  ))}
                </div>
                {deal.notes&&<div style={{...TX.body,marginTop:5,fontStyle:"italic",fontSize:10,color:T.mid}}>{deal.notes}</div>}
              </div>
              <div style={{flexShrink:0,display:"flex",flexDirection:"column",gap:4}}>
                <button onClick={e=>{e.stopPropagation();toggleStar(deal.id,deal.starred);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:deal.starred?T.goldL:T.dim,padding:0}}>
                <button onClick={e=>{e.stopPropagation();advanceStage(deal.id);}} style={{background:`${T.cyan}20`,border:`1px solid ${T.cyan}40`,borderRadius:4,color:T.cyan,fontSize:8,fontWeight:800,padding:"3px 5px",cursor:"pointer"}}>›</button>
                <button onClick={e=>{e.stopPropagation();setForm({...deal,arv:String(deal.arv),price:String(deal.price),repairs:String(deal.repairs||""),estimatedFee:String(deal.estimatedFee||"")});setEditId(deal.id);setShowForm(true);}} style={{background:`${T.gold}20`,border:`1px solid ${T.gold}40`,borderRadius:4,color:T.gold,fontSize:8,fontWeight:800,padding:"3px 5px",cursor:"pointer"}}>
              </div>
            </div>
          </div>
        );
      })}
      {selDeal&&selGrade&&(
        <Panel glow={selGrade.gc} style={{marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <GradeChip grade={selGrade.grade} color={selGrade.gc} size={20}/>
              <div><div style={{...TX.h2}}>{selDeal.address}</div><div style={{fontSize:11,fontWeight:700,color:selGrade.gc,marginTop:2}}>{selGrade.verdict} 
            </div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>deleteDeal(selDeal.id)} style={{background:`${T.red}20`,border:`1px solid ${T.red}50`,borderRadius:5,color:T.red,fontSize:9,fontWeight:700,padding:"4px 9px",cursor:"pointer"}}>Del</button>
              <button onClick={()=>setSelectedDeal(null)} style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:5,color:T.mid,fontSize:9,padding:"4px 9px",cursor:"pointer"}}>
            </div>
          </div>
          <div style={{background:`linear-gradient(135deg,${T.bg0},${T.bg1})`,border:`1px solid ${T.gold}30`,borderRadius:8,padding:"12px 14px",marginBottom:10,textAlign:"center"}}>
            <div style={{...TX.label,color:T.mid,marginBottom:3}}>Maximum Allowable Offer</div>
            <div style={{fontSize:36,fontWeight:900,color:T.gold,fontFamily:"monospace",textShadow:`0 0 20px ${T.gold}80`}}>{fmt(selGrade.mao)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {[{l:"Asking",v:fmt(selDeal.price),c:T.cyan},{l:"ARV",v:fmt(selDeal.arv),c:T.blueL},{l:"Margin",v:pctS(selGrade.margin),c:selGrade.gc},{l:"Buyer Profit",v:fmt(selGrade.buyerProfit),c:T.greenL}].map(({l,v,c})=>(
              <div key={l} style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:7,padding:"8px 10px"}}>
                <div style={{...TX.label,marginBottom:2,color:T.mid}}>{l}</div>
                <div style={{fontSize:12,fontWeight:900,color:c,fontFamily:"monospace"}}>{v}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,4,14,0.97)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,backdropFilter:"blur(4px)"}}>
          <div style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${T.cyan}40`,borderRadius:12,padding:18,width:"94%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:`0 0 50px ${T.cyan}20`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{...TX.h2,color:T.cyan}}>{editId?"Edit Deal":"Add New Deal"}</div>
              <button onClick={()=>{setShowForm(false);setEditId(null);setForm(emptyF);}} style={{background:"none",border:"none",color:T.mid,cursor:"pointer",fontSize:20}}>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{...TX.label,marginBottom:3}}>Property Address *</div>
              <input type="text" value={form.address} placeholder="123 Main St, Tucson AZ 85701" onChange={e=>setForm(p=>({...p,address:e.target.value}))}
                style={{width:"100%",background:dupCheck?`${T.red}10`:T.bg1,border:`1.5px solid ${dupCheck?T.red:form.address.length>5?T.cyan+"60":T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"8px 11px",outline:"none",fontFamily:"monospace",transition:"border-color 0.2s"}}/>
              {dupCheck&&(
                <div style={{background:`${T.red}15`,border:`1px solid ${T.redL}40`,borderRadius:6,padding:"8px 10px",marginTop:6}}>
                  <div style={{fontSize:9,fontWeight:900,color:T.redL,letterSpacing:1,marginBottom:3}}>
                  <div style={{fontSize:10,color:T.bright,fontWeight:700}}>{dupCheck.address}</div>
                  <div style={{...TX.dim,marginTop:2}}>Lead {dupCheck.leadId} · Stage: {dupCheck.stage}</div>
                  <div style={{fontSize:9,color:T.orange,fontWeight:700,marginTop:4}}>Fix the address or edit the existing deal instead.</div>
                </div>
              )}
              {!dupCheck&&form.address.length>5&&<div style={{fontSize:9,color:T.green,fontWeight:700,marginTop:4}}>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[{l:"ARV ($)*",k:"arv"},{l:"Price ($)*",k:"price"},{l:"Repairs ($)",k:"repairs"}].map(({l,k})=>(
                <div key={k}><div style={{...TX.label,marginBottom:3}}>{l}</div>
                  <input type="number" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace"}}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              <NSel label="Source" val={form.source} onChange={v=>setForm(p=>({...p,source:v}))} opts={SOURCES}/>
              <NSel label="Area"   val={form.area}   onChange={v=>setForm(p=>({...p,area:v}))}   opts={AREAS.filter(a=>a!=="All Areas")}/>
              <NSel label="Stage"  val={form.stage}  onChange={v=>setForm(p=>({...p,stage:v}))}  opts={STAGES}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              <NSel label="Partner" val={form.staff} onChange={v=>setForm(p=>({...p,staff:v}))} opts={["Acq","Ops"]}/>
              <div><div style={{...TX.label,marginBottom:3}}>Seller Name</div><input type="text" value={form.sellerName||""} onChange={e=>setForm(p=>({...p,sellerName:e.target.value}))} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace"}}/></div>
              <div><div style={{...TX.label,marginBottom:3}}>Seller Phone</div><input type="text" value={form.sellerPhone||""} onChange={e=>setForm(p=>({...p,sellerPhone:e.target.value}))} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace"}}/></div>
            </div>
            <div style={{marginBottom:10}}><div style={{...TX.label,marginBottom:3}}>Est. Assignment Fee ($)</div>
              <input type="number" value={form.estimatedFee||""} onChange={e=>setForm(p=>({...p,estimatedFee:e.target.value}))} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace"}}/>
            </div>
            <div style={{marginBottom:12}}><div style={{...TX.label,marginBottom:3}}>Notes / Situation Summary</div>
              <input type="text" value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{width:"100%",background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"7px 10px",outline:"none",fontFamily:"monospace"}}/>
            </div>
            {form.arv&&form.price&&(()=>{
              const g=calcDeal(form.arv,form.price,form.repairs||0);
              return(<div style={{background:`${g.gc}0d`,border:`1px solid ${g.gc}44`,borderRadius:8,padding:"10px 13px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <GradeChip grade={g.grade} color={g.gc} size={14}/>
                  <div><div style={{fontSize:11,fontWeight:800,color:g.gc}}>{g.verdict} · {g.urgency}</div><div style={{...TX.body,marginTop:2}}>MAO: {fmt(g.mao)} 
                </div>
              </div>);
            })()}
            <div style={{display:"flex",gap:8}}>
              <button onClick={submitDeal} disabled={!!(dupCheck&&!editId)} style={{flex:1,background:dupCheck&&!editId?T.bg2:`linear-gradient(135deg,${T.cyan}30,${T.blue}30)`,border:`1px solid ${dupCheck&&!editId?T.line:T.cyan+"60"}`,borderRadius:8,color:dupCheck&&!editId?T.mid:T.white,fontSize:12,fontWeight:800,padding:"11px",cursor:dupCheck&&!editId?"not-allowed":"pointer",opacity:dupCheck&&!editId?0.5:1}}>
                {editId?"Update Deal":"Submit Deal"}
              </button>
              <button onClick={()=>{setShowForm(false);setEditId(null);setForm(emptyF);}} style={{background:"none",border:`1px solid ${T.line}`,borderRadius:8,color:T.mid,fontSize:12,padding:"11px 16px",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── PIPELINE TAB ──────────────────────────────────────────────────────────────
function PipelineTab({deals}){
  async function advanceStage(id){
    const deal=deals.find(d=>d.id===id);if(!deal)return;
    const ns=STAGES[Math.min(STAGES.indexOf(deal.stage)+1,STAGES.length-1)];
    await updateDoc(doc(db,"deals",id),{stage:ns});
  }
  return(
    <div>
      <SecHead color={T.cyan}>Pipeline Status</SecHead>
      {STAGES.map(stage=>{
        const sd=deals.filter(d=>d.stage===stage),sc=STAGE_COLORS[stage]||T.mid;
        if(sd.length===0&&stage==="Dead Lead")return null;
        return(
          <div key={stage} style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:8,height:8,borderRadius:2,background:sc,boxShadow:`0 0 6px ${sc}`}}/>
                <div style={{fontSize:11,fontWeight:800,color:sc,textTransform:"uppercase",letterSpacing:0.5}}>{stage}</div>
                <div style={{fontSize:9,color:T.mid,fontStyle:"italic"}}>· {STAGE_MEANING[stage]}</div>
              </div>
              <Tag color={sc}>{sd.length} deal{sd.length!==1?"s":""}</Tag>
            </div>
            {sd.length===0?<div style={{background:T.bg1,border:`1px dashed ${T.line}`,borderRadius:7,padding:10,textAlign:"center",fontSize:10,color:T.dim}}>Empty</div>
              :sd.map(deal=>{
                const g=calcDeal(deal.arv,deal.price,deal.repairs);
                return(<div key={deal.id} style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${sc}25`,borderRadius:7,padding:"9px 11px",marginBottom:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{...TX.h3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.address}</div>
                      {deal.sellerName&&<div style={{fontSize:9,color:T.blueL,fontWeight:700,marginTop:2}}>{deal.sellerName}</div>}
                    </div>
                    <div style={{flexShrink:0,textAlign:"right",marginLeft:10}}>
                      <div style={{fontSize:12,color:T.gold,fontFamily:"monospace",fontWeight:900}}>{fmt(g.mao)}</div>
                      <div style={{fontSize:10,color:g.gc,fontWeight:700}}>{pctS(g.margin)}</div>
                      <button onClick={()=>advanceStage(deal.id)} style={{background:`${sc}20`,border:`1px solid ${sc}40`,borderRadius:4,color:sc,fontSize:8,fontWeight:800,padding:"2px 6px",cursor:"pointer",marginTop:3}}>Advance ›</button>
                    </div>
                  </div>
                </div>);
              })
            }
          </div>
        );
      })}
    </div>
  );
}
// ── CALCULATOR TAB ────────────────────────────────────────────────────────────
function CalcTab(){
  const [cArv,setCArv]=useState(185000);
  const [cPrice,setCPrice]=useState(0);
  const [cRep,setCRep]=useState(25000);
  const [cFee,setCFee]=useState(8000);
  const [cDisc,setCDisc]=useState(70);
  const mao=cArv*(cDisc/100)-cRep-cFee;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      <Panel glow={T.cyan}>
        <SecHead>Deal Inputs</SecHead>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          <NInput label="After Repair Value" val={cArv} onChange={v=>setCArv(+v||0)} prefix="$"/>
          <NInput label="Repair Estimate"    val={cRep} onChange={v=>setCRep(+v||0)} prefix="$"/>
          <NInput label="Your Fee"           val={cFee} onChange={v=>setCFee(+v||0)} prefix="$"/>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{...TX.label}}>Investor Discount</span>
            <span style={{fontSize:13,color:T.cyan,fontFamily:"monospace",fontWeight:900}}>{cDisc}%</span>
          </div>
          <input type="range" min={55} max={85} value={cDisc} onChange={e=>setCDisc(+e.target.value)} style={{width:"100%",accentColor:T.cyan}}/>
        </div>
      </Panel>
      <div style={{background:`linear-gradient(135deg,${T.bg1},${T.bg2})`,border:`1px solid ${T.gold}40`,borderRadius:10,padding:"16px 18px",textAlign:"center",boxShadow:`0 0 30px ${T.gold}15`}}>
        <div style={{...TX.label,color:T.mid,marginBottom:4}}>Maximum Allowable Offer</div>
        <div style={{fontSize:44,fontWeight:900,color:T.gold,fontFamily:"monospace",textShadow:`0 0 25px ${T.gold}90`}}>{fmt(mao)}</div>
        <div style={{...TX.body,marginTop:6,color:T.mid}}>{fmt(cArv)} × {cDisc}% − {fmt(cRep)} repairs 
      </div>
      <Panel>
        <SecHead>Enter Asking Price · Get Verdict</SecHead>
        <NInput label="Seller's Asking Price" val={cPrice||""} onChange={v=>setCPrice(+v||0)} prefix="$"/>
        {cPrice>0&&(()=>{
          const g=calcDeal(cArv,cPrice,cRep,cFee,cDisc/100);
          return(<div style={{marginTop:10,background:g.isProfitable?`${T.green}15`:`${T.red}10`,border:`1px solid ${g.isProfitable?T.green:T.red}40`,borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:15,fontWeight:900,color:g.isProfitable?T.greenL:T.red}}>{g.verdict} 
            <div style={{...TX.body,marginTop:4}}>Grade: {g.grade} · Margin: {pctS(g.margin)} 
          </div>);
        })()}
      </Panel>
    </div>
  );
}
// ── BUYERS TAB ────────────────────────────────────────────────────────────────
function BuyersTab({buyers,push}){
  const [showForm,setShowForm]=useState(false);
  const emptyB={name:"",phone:"",email:"",area:"Tucson Metro",repairTol:"Light",responseSpeed:"Fast",notes:"",pof:false};
  const [form,setForm]=useState(emptyB);
  async function addBuyer(){
    if(!form.name){push("Buyer name required","error");return;}
    await addDoc(collection(db,"buyers"),{...form,pof:!!form.pof,ts:Date.now()});
    setShowForm(false);setForm(emptyB);push("Buyer added");
  }
  async function deleteBuyer(id){await deleteDoc(doc(db,"buyers",id));push("Buyer removed");}
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <SecHead>Cash Buyer List ({buyers.length})</SecHead>
        <button onClick={()=>setShowForm(true)} style={{background:`${T.cyan}20`,border:`1px solid ${T.cyan}50`,borderRadius:6,color:T.cyan,fontSize:9,fontWeight:800,padding:"5px 11px",cursor:"pointer"}}>+ ADD BUYER</button>
      </div>
      {buyers.map(b=>(
        <Panel key={b.id} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{...TX.h2,marginBottom:5}}>{b.name}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                <Tag color={b.pof?T.greenL:T.orange}>{b.pof?"✓ POF Verified":"POF Needed"}</Tag>
                <Tag color={T.blue}>{b.area}</Tag><Tag color={T.purple}>{b.repairTol} Rehab</Tag><Tag color={T.teal}>{b.responseSpeed} Response</Tag>
              </div>
              <div style={{display:"flex",gap:10}}><span style={{...TX.body,fontSize:10}}>{b.phone}</span><span style={{...TX.body,fontSize:10}}>{b.email}</span></div>
              {b.notes&&<div style={{...TX.body,marginTop:4,fontStyle:"italic",fontSize:10,color:T.mid}}>{b.notes}</div>}
            </div>
            <button onClick={()=>deleteBuyer(b.id)} style={{background:"none",border:"none",color:T.mid,cursor:"pointer",fontSize:16,padding:0,marginLeft:8}}>
          </div>
        </Panel>
      ))}
      {showForm&&(
        <Panel glow={T.cyan}>
          <SecHead>Add Cash Buyer</SecHead>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <NInput label="Buyer Name"  val={form.name}  onChange={v=>setForm(p=>({...p,name:v}))}  type="text"/>
            <NInput label="Phone"       val={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} type="text"/>
            <NInput label="Email"       val={form.email} onChange={v=>setForm(p=>({...p,email:v}))} type="text"/>
            <NInput label="Target Area" val={form.area}  onChange={v=>setForm(p=>({...p,area:v}))}  type="text"/>
            <NSel label="Repair Tolerance" val={form.repairTol}     onChange={v=>setForm(p=>({...p,repairTol:v}))}     opts={["Light","Medium","Heavy","Any"]}/>
            <NSel label="Response Speed"   val={form.responseSpeed} onChange={v=>setForm(p=>({...p,responseSpeed:v}))} opts={["Fast","Medium","Slow"]}/>
          </div>
          <NInput label="Notes" val={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} type="text"/>
          <div style={{display:"flex",alignItems:"center",gap:9,margin:"10px 0"}}>
            <input type="checkbox" checked={form.pof} onChange={e=>setForm(p=>({...p,pof:e.target.checked}))} style={{accentColor:T.cyan}}/>
            <span style={{...TX.body,fontWeight:700}}>Proof of Funds Verified</span>
          </div>
          <div style={{display:"flex",gap:7}}>
            <button onClick={addBuyer} style={{flex:1,background:`linear-gradient(135deg,${T.cyan}30,${T.blue}30)`,border:`1px solid ${T.cyan}60`,borderRadius:7,color:T.white,fontSize:11,fontWeight:800,padding:"9px",cursor:"pointer"}}>Add Buyer</button>
            <button onClick={()=>setShowForm(false)} style={{background:"none",border:`1px solid ${T.line}`,borderRadius:7,color:T.mid,fontSize:11,padding:"9px 14px",cursor:"pointer"}}>Cancel</button>
          </div>
        </Panel>
      )}
    </div>
  );
}
// ── SCRIPTS TAB ───────────────────────────────────────────────────────────────
function ScriptsTab(){
  const [filter,setFilter]=useState("ALL");
  const [copiedIdx,setCopiedIdx]=useState(null);
  return(
    <div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        {["ALL","ACQ","OPS","TITLE"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?`${T.cyan}20`:"none",border:`1px solid ${filter===f?T.cyan+"60":T.line}`,borderRadius:5,color:filter===f?T.cyan:T.mid,fontSize:9,fontWeight:700,padding:"4px 11px",cursor:"pointer"}}>
            {f==="ALL"?"All Scripts":f==="ACQ"?"Acquisition":f==="OPS"?"Operations":"Title"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {ALL_SCRIPTS.filter(s=>filter==="ALL"||s.role===filter).map((s,i)=>(
          <Panel key={i}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}><Tag color={s.color}>{s.role}</Tag><span style={{...TX.h3}}>{s.title}</span></div>
              <button onClick={()=>{navigator.clipboard.writeText(s.body);setCopiedIdx(i);setTimeout(()=>setCopiedIdx(null),2000);}}
                style={{background:copiedIdx===i?`${T.green}20`:`${T.cyan}15`,border:`1px solid ${copiedIdx===i?T.green+"60":T.cyan+"40"}`,borderRadius:5,color:copiedIdx===i?T.greenL:T.cyan,fontSize:8,fontWeight:800,padding:"3px 9px",cursor:"pointer"}}>
                {copiedIdx===i?"✓ COPIED":"COPY"}
              </button>
            </div>
            <div style={{background:T.bg1,border:`1px solid ${T.line}`,borderRadius:7,padding:"10px 12px",fontSize:10,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{s.body}</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
// ── SITES TAB ─────────────────────────────────────────────────────────────────
function SitesTab(){
  const [search,setSearch]=useState("");
  const [activeCat,setActiveCat]=useState("All");
  const cats=["All",...LEAD_SITES.map(c=>c.cat)];
  const q=search.toLowerCase().trim();
  const filtered=LEAD_SITES.map(cat=>({...cat,sites:cat.sites.filter(s=>!q||s.name.toLowerCase().includes(q)||s.desc.toLowerCase().includes(q)||s.tip.toLowerCase().includes(q))})).filter(cat=>(activeCat==="All"||cat.cat===activeCat)&&cat.sites.length>0);
  return(
    <div>
      <div style={{background:`linear-gradient(135deg,${T.bg1},${T.bg3})`,border:`1px solid ${T.cyanL}30`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
        <div style={{...TX.h2,color:T.cyanL,marginBottom:4}}>Lead Source Directory</div>
        <div style={{...TX.body}}>32 vetted platforms for finding motivated sellers · Updated 2026</div>
      </div>
      <div style={{background:T.bg2,border:`1px solid ${T.cyan}40`,borderRadius:8,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",marginBottom:10}}>
        <span style={{fontSize:14,color:T.cyan}}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sites, tips, categories..."
          style={{flex:1,background:"none",border:"none",color:T.white,fontSize:11,outline:"none",fontFamily:"monospace",fontWeight:600}}/>
        {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:T.mid,cursor:"pointer",fontSize:14}}>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setActiveCat(c)} style={{background:activeCat===c?`${T.cyan}20`:"none",border:`1px solid ${activeCat===c?T.cyan+"60":T.line}`,borderRadius:5,color:activeCat===c?T.cyan:T.mid,fontSize:8,fontWeight:700,padding:"3px 9px",cursor:"pointer",whiteSpace:"nowrap"}}>
            {c==="All"?"All Sites":c}
          </button>
        ))}
      </div>
      {filtered.length===0&&<div style={{textAlign:"center",padding:"30px",color:T.mid,fontSize:11}}>No sites match your search</div>}
      {filtered.map(cat=>(
        <div key={cat.cat} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{background:`${cat.color}20`,border:`1px solid ${cat.color}50`,borderRadius:6,padding:"3px 9px",fontSize:9,fontWeight:900,color:cat.color}}>{cat.icon}</div>
            <div style={{fontSize:11,fontWeight:800,color:cat.color,textTransform:"uppercase",letterSpacing:1}}>{cat.cat}</div>
            <div style={{flex:1,height:1,background:`${cat.color}20`}}/>
            <div style={{fontSize:9,color:T.mid}}>{cat.sites.length} site{cat.sites.length!==1?"s":""}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {cat.sites.map((site,i)=>(
              <div key={i} style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${cat.color}25`,borderRadius:8,padding:"10px 11px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                  <div style={{...TX.h3,color:cat.color}}>{site.name}</div>
                  <a href={site.url} target="_blank" rel="noreferrer"
                    style={{background:`${cat.color}20`,border:`1px solid ${cat.color}50`,borderRadius:4,color:cat.color,fontSize:8,fontWeight:800,padding:"2px 7px",textDecoration:"none",flexShrink:0}}>OPEN 
                </div>
                <div style={{...TX.body,fontSize:10,marginBottom:7,lineHeight:1.5}}>{site.desc}</div>
                <div style={{background:`${cat.color}0a`,border:`1px solid ${cat.color}20`,borderRadius:5,padding:"5px 8px"}}>
                  <div style={{fontSize:8,fontWeight:800,color:cat.color,letterSpacing:1,marginBottom:2}}>PRO TIP</div>
                  <div style={{fontSize:9,color:T.bright,lineHeight:1.6,fontWeight:600}}>{site.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
// ── PRICING TAB ───────────────────────────────────────────────────────────────
function PricingTab(){
  const [zipInput,setZipInput]=useState("");
  const [searchedZip,setSearchedZip]=useState("");
  const [region,setRegion]=useState(null);
  const [activeWork,setActiveWork]=useState(null);
  const [sqft,setSqft]=useState(1500);
  function lookupZip(){
    const z=zipInput.trim();if(z.length<5)return;
    const p3=z.slice(0,3),p4=z.slice(0,4);
    const match=ZIP_REGIONS.find(r=>r.prefixes.includes(p3)||r.prefixes.includes(p4));
    setSearchedZip(z);setRegion(match||ZIP_REGIONS.find(r=>r.prefixes.includes("*")));
  }
  const applyMult=(base)=>region?Math.round(base*region.mult):base;
  const tiers=[
    {key:"low", label:"LOW", sublabel:"Budget / 1-2 bids",color:T.green},
    {key:"mid", label:"MID", sublabel:"Standard / 3 bids",color:T.gold},
    {key:"high",label:"HIGH",sublabel:"Premium / rushed",  color:T.orange},
  ];
  return(
    <div>
      <div style={{background:`linear-gradient(135deg,${T.bg1},${T.bg3})`,border:`1px solid ${T.gold}30`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
        <div style={{...TX.h2,color:T.goldL,marginBottom:4}}>Contractor Pricing by ZIP Code</div>
        <div style={{...TX.body}}>2026 national pricing database · Low / Mid / High tiers · Regional COL adjusted</div>
      </div>
      <div style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${T.gold}40`,borderRadius:10,padding:"14px",marginBottom:10}}>
        <SecHead color={T.goldL}>ZIP Code Lookup</SecHead>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1,background:T.bg1,border:`1px solid ${T.gold}50`,borderRadius:8,display:"flex",alignItems:"center",gap:8,padding:"0 12px"}}>
            <span style={{fontSize:14,color:T.gold}}> </span>
            <input value={zipInput} onChange={e=>setZipInput(e.target.value.replace(/\D/g,"").slice(0,5))}
              onKeyDown={e=>{if(e.key==="Enter")lookupZip();}}
              placeholder="Enter ZIP code (e.g. 85701)"
              style={{flex:1,background:"none",border:"none",color:T.white,fontSize:13,outline:"none",fontFamily:"monospace",fontWeight:700,padding:"10px 0"}}/>
            {zipInput&&<button onClick={()=>{setZipInput("");setRegion(null);setSearchedZip("");}} style={{background:"none",border:"none",color:T.mid,cursor:"pointer",fontSize:14}}>
          </div>
          <button onClick={lookupZip} style={{background:`linear-gradient(135deg,${T.gold}30,${T.orange}20)`,border:`1px solid ${T.gold}60`,borderRadius:8,color:T.goldL,fontSize:11,fontWeight:900,padding:"0 18px",cursor:"pointer",whiteSpace:"nowrap"}}>LOOK UP</button>
        </div>
        {region&&searchedZip&&(
          <div style={{background:`${T.gold}08`,border:`1px solid ${T.gold}30`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
              <div>
                <div style={{fontSize:12,fontWeight:900,color:T.goldL}}> {region.label}</div>
                <div style={{...TX.dim,marginTop:2}}>ZIP {searchedZip} · Multiplier: <span style={{color:region.mult>1.2?T.orange:region.mult<0.95?T.green:T.gold,fontWeight:900}}>{region.mult.toFixed(2)}
                <div style={{fontSize:9,color:T.text,marginTop:3,fontStyle:"italic"}}>{region.note}</div>
              </div>
              <div style={{background:region.mult>1.3?`${T.red}20`:region.mult<0.95?`${T.green}20`:`${T.gold}20`,border:`1px solid ${region.mult>1.3?T.red:region.mult<0.95?T.green:T.gold}50`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:region.mult>1.3?T.redL:region.mult<0.95?T.greenL:T.goldL,fontFamily:"monospace"}}>{region.mult.toFixed(2)}
                <div style={{fontSize:8,color:T.mid,fontWeight:700,letterSpacing:0.5}}>{region.mult>1.3?"HIGH COST":region.mult<0.95?"BELOW AVG":"AT/NEAR AVG"}</div>
              </div>
            </div>
          </div>
        )}
        {region&&(
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{...TX.label,whiteSpace:"nowrap",color:T.mid}}>House Sq Ft:</div>
            <input type="number" value={sqft} onChange={e=>setSqft(+e.target.value||1500)} style={{flex:1,background:T.bg1,border:`1px solid ${T.line2}`,borderRadius:6,color:T.white,fontSize:11,padding:"6px 10px",outline:"none",fontFamily:"monospace",fontWeight:700}}/>
          </div>
        )}
      </div>
      {!region&&!searchedZip&&(
        <div style={{textAlign:"center",padding:"24px",color:T.mid,fontSize:11}}>
          <div style={{fontSize:28,marginBottom:8}}> </div>
          <div style={{fontWeight:700,color:T.text}}>Enter a ZIP code above to see local contractor pricing</div>
          <div style={{fontSize:10,marginTop:4}}>Covers 40+ major metro areas · 2026 pricing</div>
        </div>
      )}
      {region&&(
        <div>
          <SecHead color={T.goldL}>2026 Contractor Pricing · {region.label}</SecHead>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
            {tiers.map(tier=>(
              <div key={tier.key} style={{background:`${tier.color}10`,border:`1px solid ${tier.color}40`,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:900,color:tier.color,letterSpacing:1}}>{tier.label}</div>
                <div style={{fontSize:8,color:T.mid,marginTop:2}}>{tier.sublabel}</div>
              </div>
            ))}
          </div>
          {BASE_CONTRACTOR_WORK.map((work,i)=>{
            const isOpen=activeWork===work.id;
            return(
              <div key={i} style={{background:isOpen?T.bg4:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${isOpen?T.gold+"50":T.line}`,borderRadius:9,marginBottom:6,overflow:"hidden",transition:"all 0.2s"}}>
                <div onClick={()=>setActiveWork(isOpen?null:work.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",cursor:"pointer"}}>
                  <div style={{fontSize:18,flexShrink:0}}>{work.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{...TX.h3,color:T.white}}>{work.name}</div>
                    <div style={{...TX.dim,marginTop:1}}>{work.unit}</div>
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    {[{v:fmt(applyMult(work.low)),c:T.green},{v:fmt(applyMult(work.mid)),c:T.gold},{v:fmt(applyMult(work.high)),c:T.orange}].map(({v,c},j)=>(
                      <div key={j} style={{background:`${c}15`,border:`1px solid ${c}30`,borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:800,color:c,fontFamily:"monospace"}}>{v}</div>
                    ))}
                  </div>
                  <div style={{color:isOpen?T.gold:T.mid,fontSize:14,fontWeight:900,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"none",marginLeft:4}}>›</div>
                </div>
                {isOpen&&(
                  <div style={{borderTop:`1px solid ${T.gold}20`,padding:"12px 14px"}}>
                    <div style={{...TX.body,fontSize:10,color:T.text,marginBottom:12,fontStyle:"italic"}}>{work.desc}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                      {tiers.map(tier=>(
                        <div key={tier.key} style={{background:`${tier.color}10`,border:`1px solid ${tier.color}40`,borderRadius:8,padding:"10px"}}>
                          <div style={{fontSize:9,fontWeight:900,color:tier.color,letterSpacing:1,marginBottom:4}}>{tier.label}</div>
                          <div style={{fontSize:14,fontWeight:900,color:tier.color,fontFamily:"monospace"}}>{fmt(applyMult(work[tier.key]))}</div>
                          {work.unit.includes("sq ft")&&<div style={{fontSize:9,color:T.text,marginTop:4,fontWeight:700}}>~{fmt(applyMult(work[tier.key])*sqft)} for {sqft.toLocaleString()} sqft</div>}
                          <div style={{fontSize:9,color:T.mid,marginTop:2}}>{work.unit}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:`${T.cyan}08`,border:`1px solid ${T.cyan}20`,borderRadius:6,padding:"7px 10px"}}>
                      <div style={{fontSize:8,fontWeight:900,color:T.cyan,letterSpacing:1,marginBottom:3}}>REGIONAL ADJUSTMENT 
                      <div style={{fontSize:9,color:T.text}}>National base: {fmt(work.low)} / {fmt(work.mid)} / {fmt(work.high)} 
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{background:`${T.mid}15`,border:`1px solid ${T.line}`,borderRadius:8,padding:"10px 12px",marginTop:8}}>
            <div style={{fontSize:9,fontWeight:900,color:T.mid,marginBottom:4}}>⚠ DISCLAIMER 
            <div style={{fontSize:9,color:T.dim,lineHeight:1.6}}>Prices are 2026 estimates. Actual bids vary by scope and contractor availability. Use as a sanity check — never as your only estimate.</div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── SOP TAB ───────────────────────────────────────────────────────────────────
function SopTab(){
  const [lawOpen,setLawOpen]=useState(null);
  return(
    <div>
      <div style={{background:`linear-gradient(135deg,${T.bg1},${T.bg2})`,border:`1px solid ${T.redL}30`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
        <div style={{...TX.h1,color:T.redL}}>The 12 Iron Laws</div>
        <div style={{...TX.body,marginTop:5}}>Zero Exceptions. Zero Wiggle Room. Maximum Results.</div>
      </div>
      {IRON_LAWS.map((law,i)=>(
        <div key={i} style={{background:lawOpen===i?`${law.color}0d`:`linear-gradient(135deg,${T.bg3},${T.bg2})`,border:`1px solid ${lawOpen===i?law.color+"50":T.line}`,borderRadius:9,marginBottom:6,overflow:"hidden",transition:"all 0.2s"}}>
          <div onClick={()=>setLawOpen(lawOpen===i?null:i)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",cursor:"pointer"}}>
            <div style={{width:28,height:28,borderRadius:6,background:`${law.color}20`,border:`1px solid ${law.color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:law.color,flexShrink:0}}>{law.n}</div>
            <div style={{flex:1}}><div style={{...TX.h3,fontSize:12,color:T.white}}>{law.law}</div></div>
            <div style={{color:lawOpen===i?law.color:T.mid,fontSize:14,fontWeight:900,transition:"transform 0.2s",transform:lawOpen===i?"rotate(90deg)":"none"}}>›</div>
          </div>
          {lawOpen===i&&(
            <div style={{padding:"0 13px 13px",borderTop:`1px solid ${law.color}20`}}>
              <div style={{background:`${law.color}0d`,border:`1px solid ${law.color}25`,borderRadius:7,padding:"10px 12px"}}>
                <div style={{...TX.body,color:T.bright,lineHeight:1.8}}>{law.detail}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("command");
  const [deals,setDeals]=useState([]);
  const [buyers,setBuyers]=useState([]);
  const [kpiVals,setKpiVals]=useState({});
  const [syncStatus,setSyncStatus]=useState("connecting");
  const {toasts,push}=useToast();
  const [pulse,setPulse]=useState(false);
  const [clock,setClock]=useState(new Date());
  const [gSearch,setGSearch]=useState("");
  const [gFocused,setGFocused]=useState(false);
  const searchRef=useRef(null);
  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setPulse(p=>!p),1800);return()=>clearInterval(t);},[]);
  // ── Firebase live listeners ───────────────────────────────────────────────
  useEffect(()=>{
    setSyncStatus("connecting");
    const unsubDeals=onSnapshot(collection(db,"deals"),
      snap=>{setDeals(snap.docs.map(d=>({...d.data(),id:d.id})));setSyncStatus("live");},
      ()=>setSyncStatus("error")
    );
    const unsubBuyers=onSnapshot(collection(db,"buyers"),
      snap=>setBuyers(snap.docs.map(d=>({...d.data(),id:d.id})))
    );
    const unsubKpi=onSnapshot(doc(db,"kpis","weekly"),
      snap=>{if(snap.exists())setKpiVals(snap.data());}
    );
    return()=>{unsubDeals();unsubBuyers();unsubKpi();};
  },[]);
  useEffect(()=>{
    const h=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setGFocused(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  const alertDeals=deals.filter(d=>{const g=calcDeal(d.arv,d.price,d.repairs);return g.isProfitable&&!["Closed","Dead Lead"].includes(d.stage);});
  const totalEarned=deals.filter(d=>d.stage==="Closed").reduce((s,d)=>s+(+d.estimatedFee||0),0);
  const gq=gSearch.toLowerCase().trim();
  const searchResults=gq.length>1?[
    ...deals.filter(d=>d.address?.toLowerCase().includes(gq)||(d.sellerName||"").toLowerCase().includes(gq)||(d.leadId||"").toLowerCase().includes(gq)||d.stage?.toLowerCase().includes(gq)).map(d=>({...d,_type:"deal"})),
    ...buyers.filter(b=>b.name?.toLowerCase().includes(gq)||(b.phone||"").toLowerCase().includes(gq)||(b.area||"").toLowerCase().includes(gq)).map(b=>({...b,_type:"buyer"})),
    ...LEAD_SITES.flatMap(cat=>cat.sites.filter(s=>s.name.toLowerCase().includes(gq)||s.desc.toLowerCase().includes(gq)).map(s=>({...s,_type:"site",cat:cat.cat,color:cat.color}))),
  ]:[];
  function handleSearchSelect(r){
    setGSearch("");setGFocused(false);
    if(r._type==="deal")setTab("deals");
    else if(r._type==="buyer")setTab("people");
    else if(r._type==="site")setTab("sites");
  }
  const syncColor=syncStatus==="live"?T.green:syncStatus==="error"?T.red:T.gold;
  const syncLabel=syncStatus==="live"?"LIVE":syncStatus==="error"?"ERROR":"SYNC…";
  const globalCSS=`
    *{box-sizing:border-box;}body{margin:0;background:${T.bg0};}
    input,select{color-scheme:dark;}input::placeholder{color:${T.dim};}
    ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:${T.bg0};}
    ::-webkit-scrollbar-thumb{background:${T.line2};border-radius:4px;}
    ::-webkit-scrollbar-thumb:hover{background:${T.cyan}50;}
  `;
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:T.bg0,fontFamily:"'Courier New',monospace",color:T.text,overflow:"hidden",position:"relative"}}>
      <style>{globalCSS}</style>
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:9999,background:`repeating-linear-gradient(0deg,transparent,transparent 2px,${T.cyan}03 2px,${T.cyan}03 4px)`,opacity:0.35}}/>
      {/* TOASTS */}
      <div style={{position:"fixed",top:50,right:8,zIndex:1000,display:"flex",flexDirection:"column",gap:6}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:t.type==="alert"?`${T.redL}f0`:t.type==="error"?`${T.red}e0`:`${T.bg4}f0`,border:`1px solid ${t.type==="alert"?T.redL:t.type==="error"?T.red:T.cyan}60`,borderRadius:8,padding:"8px 13px",fontSize:11,fontWeight:700,color:T.white,boxShadow:`0 4px 20px #00000080`,maxWidth:260,backdropFilter:"blur(10px)"}}>{t.msg}</div>
        ))}
      </div>
      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 10px",height:46,background:`linear-gradient(180deg,${T.bg4},${T.bg3})`,borderBottom:`1px solid ${T.line2}`,boxShadow:`0 2px 20px #00000080,0 0 30px ${T.cyan}08`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:pulse?syncColor:T.cyanD,boxShadow:`0 0 ${pulse?12:6}px ${pulse?syncColor:T.cyanD}`,transition:"all 0.3s"}}/>
          <div>
            <div style={{fontSize:12,fontWeight:900,letterSpacing:2.5,background:`linear-gradient(90deg,${T.cyan},${T.elec},${T.blue})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>BASE APEX V8.0</div>
            <div style={{fontSize:7,color:syncColor,letterSpacing:1,fontWeight:700}}>{clock.toLocaleTimeString()} 
          </div>
        </div>
        {/* GLOBAL SEARCH */}
        <div ref={searchRef} style={{flex:1,position:"relative",maxWidth:420}}>
          <div style={{display:"flex",alignItems:"center",background:T.bg1,border:`1.5px solid ${gFocused?T.cyan:T.line2}`,borderRadius:8,padding:"5px 10px",gap:7,boxShadow:gFocused?`0 0 14px ${T.cyan}30`:"none",transition:"all 0.2s"}}>
            <span style={{fontSize:12,color:T.cyan}}>⌕</span>
            <input value={gSearch} onChange={e=>setGSearch(e.target.value)} onFocus={()=>setGFocused(true)}
              placeholder="Search deals, buyers, sites..."
              style={{flex:1,background:"none",border:"none",color:T.white,fontSize:10,outline:"none",fontFamily:"monospace",fontWeight:600}}/>
            {gSearch&&<button onClick={()=>{setGSearch("");setGFocused(false);}} style={{background:"none",border:"none",color:T.mid,cursor:"pointer",fontSize:13,lineHeight:1,padding:0}}>
          </div>
          {gFocused&&gq.length>1&&(
            <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,background:T.bg3,border:`1px solid ${T.cyan}40`,borderRadius:9,zIndex:600,boxShadow:`0 8px 30px #00000090,0 0 20px ${T.cyan}15`,overflow:"hidden"}}>
              {searchResults.length===0
                ?<div style={{padding:"14px 12px",textAlign:"center",fontSize:10,color:T.mid}}>No results for "{gSearch}"</div>
                :<div style={{maxHeight:300,overflowY:"auto"}}>
                  {searchResults.slice(0,12).map((r,i)=>(
                    <div key={i} onMouseDown={()=>handleSearchSelect(r)} style={{padding:"8px 13px",cursor:"pointer",borderBottom:`1px solid ${T.line}`,display:"flex",alignItems:"center",gap:9}}
                      onMouseEnter={e=>e.currentTarget.style.background=`${T.cyan}10`}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{width:28,height:22,borderRadius:4,background:r._type==="deal"?`${T.gold}20`:r._type==="buyer"?`${T.green}20`:`${r.color||T.cyan}20`,border:`1px solid ${r._type==="deal"?T.gold:r._type==="buyer"?T.green:r.color||T.cyan}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:900,color:r._type==="deal"?T.gold:r._type==="buyer"?T.green:r.color||T.cyan,flexShrink:0}}>
                        {r._type==="deal"?"DEAL":r._type==="buyer"?"BUY":"SITE"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{...TX.h3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r._type==="deal"?r.address:r.name}</div>
                        <div style={{...TX.dim}}>{r._type==="deal"?`${r.stage} · ${r.leadId}`:r._type==="buyer"?`Buyer 
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:0,flexShrink:0}}>
          {[{l:"Alerts",v:alertDeals.length,c:alertDeals.length>0?T.redL:T.dim},{l:"Deals",v:deals.length,c:T.cyan},{l:"Earned",v:fmt(totalEarned),c:T.greenL}].map(({l,v,c})=>(
            <div key={l} style={{textAlign:"center",padding:"2px 9px",borderLeft:`1px solid ${T.line}`}}>
              <div style={{fontSize:14,fontWeight:900,color:c,lineHeight:1.3,fontFamily:"monospace",textShadow:`0 0 10px ${c}60`}}>{v}</div>
              <div style={{fontSize:7,color:T.mid,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* QUICK NAV */}
      <div style={{display:"flex",background:T.bg4,borderBottom:`1px solid ${T.line}`,padding:"0 6px",overflowX:"auto",height:30,alignItems:"center",gap:2,flexShrink:0}}>
        <span style={{fontSize:8,color:T.mid,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginRight:4,whiteSpace:"nowrap"}}>APEX ›</span>
        {[{id:"command",label:"Command"},{id:"deals",label:"Deals"},{id:"pipeline",label:"Pipeline"},{id:"calc",label:"Calc"},{id:"sites",label:"Sites"},{id:"pricing",label:"Pricing"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`${T.cyan}20`:"none",border:`1px solid ${tab===t.id?T.cyan+"50":"transparent"}`,borderRadius:5,color:tab===t.id?T.cyan:T.mid,fontSize:9,fontWeight:700,letterSpacing:0.5,padding:"3px 9px",cursor:"pointer",textTransform:"uppercase",transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.label}</button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>setTab("deals")} style={{background:`linear-gradient(135deg,${T.cyan}20,${T.blue}20)`,border:`1px solid ${T.cyan}60`,borderRadius:5,color:T.cyan,fontSize:9,fontWeight:800,padding:"3px 10px",cursor:"pointer",letterSpacing:1,boxShadow:`0 0 10px ${T.cyan}25`,textTransform:"uppercase",whiteSpace:"nowrap"}}>+ NEW DEAL</button>
      </div>
      {/* CONTENT */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:10,paddingBottom:62}}>
        {tab==="command"  &&<CommandTab  deals={deals} kpiVals={kpiVals} setKpiVals={setKpiVals}/>}
        {tab==="team"     &&<TeamTab/>}
        {tab==="deals"    &&<DealsTab    deals={deals} push={push}/>}
        {tab==="pipeline" &&<PipelineTab deals={deals}/>}
        {tab==="calc"     &&<CalcTab/>}
        {tab==="people"   &&<BuyersTab   buyers={buyers} push={push}/>}
        {tab==="scripts"  &&<ScriptsTab/>}
        {tab==="sites"    &&<SitesTab/>}
        {tab==="pricing"  &&<PricingTab/>}
        {tab==="sop"      &&<SopTab/>}
      </div>
      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:`linear-gradient(180deg,${T.bg3},${T.bg4})`,borderTop:`1px solid ${T.line2}`,display:"flex",boxShadow:`0 -4px 20px #00000060,0 0 20px ${T.cyan}06`,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"5px 1px 6px",borderTop:`2px solid ${tab===t.id?T.cyan:"transparent"}`,transition:"all 0.15s",minWidth:0}}>
            <div style={{fontSize:tab===t.id?7.5:7,letterSpacing:0.2,textTransform:"uppercase",color:tab===t.id?T.cyan:T.mid,fontWeight:tab===t.id?800:600,textShadow:tab===t.id?`0 0 8px ${T.cyan}80`:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 2px"}}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
