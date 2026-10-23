import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import express from "express";
import multer from "multer";
import ts from "typescript";
import { parseCustomIntegrationFile, isSupportedCustomIntegrationFile, supportedCustomIntegrationFileDescription } from "./services/custom-integration-file-parser";
function buildStoredZip(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function buildXlsxBuffer(rows: string[][]): Buffer {
  const colRef = (index: number) => {
    let n = index + 1;
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  const esc = (value: string) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((value, c) => `<c r="${colRef(c)}${r + 1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return buildStoredZip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}


const csv = (text: string) => parseCustomIntegrationFile(Buffer.from(text), "report.csv", "text/csv");
const xlsx = (data: Buffer) => parseCustomIntegrationFile(data, "report.xlsx");
describe("Batch 4 Custom Integration complete input contract", () => {
  it("imports all 5,000 rows and rejects row 5,001", async () => {
    expect((await csv("Spend\n" + "1\n".repeat(5000))).spend).toBe(5000);
    await expect(csv("Spend\n" + "1\n".repeat(5001))).rejects.toThrow();
  });
  it.each(["100junk", "12,34", "1.234,56", "$10", "\u20ac10", "GBP 10", "1e3", "NaN", "Infinity", "10.001", "-10", "10%"])("rejects ambiguous spend %s", async value => {
    await expect(csv(`Spend\n"${value}"`)).rejects.toThrow();
  });
  it.each(["Spend,Spend", "Spend,spend", "Spend,Ad Spend"])("rejects duplicate mappings %s", async header => {
    await expect(csv(`${header}\n100,7`)).rejects.toThrow();
  });
  it("rejects malformed CSV and currency columns without publishing a partial sum", async () => {
    await expect(csv('Spend\n"100')).rejects.toThrow();
    await expect(csv('Spend,Currency\n100,EUR')).rejects.toThrow();
    await expect(csv('Spend\n100\ninvalid')).rejects.toThrow();
  });
  it("preserves explicit zero and supported grouping", async () => {
    expect((await csv('Spend\n0')).spend).toBe(0);
    expect((await csv('Spend\n"1,234.56"')).spend).toBe(1234.56);
  });
  it.each(["Emails Sent", "Opens", "Exit Rate", "New Subscribers", "Hard Bounces", "Spam Complaints"])("does not reinterpret %s", async label => {
    const result = await csv(`${label}\n50`);
    expect(result._requiresReview).toBe(true);
    expect(result._extractedFields).toBe(0);
  });
  it("requires integer count storage and supported decimal precision", async () => {
    await expect(csv('Conversions\n0.75')).rejects.toThrow("Fractional");
    await expect(csv('Spend\n99999999.99\n1')).rejects.toThrow("total");
  });
  it("rejects duplicate XLSX headers before overwrite", async () => {
    await expect(xlsx(buildXlsxBuffer([["Spend", "Spend"], ["100", "7"]]))).rejects.toThrow("unique");
  });
  const sheets = (reverse: boolean, visible = 1) => {
    const report = (value: number) => `<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Spend</t></is></c></row><row><c r="A2"><v>${value}</v></c></row></sheetData></worksheet>`;
    const entries = {
      "xl/workbook.xml": `<workbook><sheets><sheet name="Hidden" state="hidden" r:id="rId2"/><sheet name="Report" r:id="rId1"/>${visible === 2 ? '<sheet name="Other" r:id="rId3"/>' : ''}</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
      "xl/worksheets/sheet2.xml": report(200),
      "xl/worksheets/sheet1.xml": report(10),
    };
    return buildStoredZip(Object.fromEntries(reverse ? Object.entries(entries).reverse() : Object.entries(entries)));
  };
  it.each([false, true])("selects only the workbook-visible worksheet independent of ZIP order %s", async reverse => {
    expect((await xlsx(sheets(reverse))).spend).toBe(10);
  });
  it("rejects multiple visible worksheets and missing workbook metadata", async () => {
    await expect(xlsx(sheets(false, 2))).rejects.toThrow("one visible");
    await expect(xlsx(buildStoredZip({ "xl/worksheets/sheet1.xml": "<worksheet/>" }))).rejects.toThrow("one visible");
  });
  it("rejects compressed expansion before inflation (12MiB bounded fixture)", async () => {
    const data = Buffer.alloc(12 * 1024 * 1024, 65), compressed = deflateRawSync(data);
    const name = Buffer.from("padding.xml"), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + compressed.length, 16);
    await expect(xlsx(Buffer.concat([local, name, compressed, central, name, end]))).rejects.toThrow("expanded");
  });
  it("rejects excessive ZIP entries and compressed input bytes", async () => {
    await expect(xlsx(buildStoredZip(Object.fromEntries(Array.from({length:257}, (_,i)=>[`${i}.xml`, ""])) ))).rejects.toThrow("archive");
    await expect(xlsx(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow("10MB");
  });
  it("preserves all 28 declared metric fields including explicit zeros", async () => {
    const fields = {impressions:"Impressions",reach:"Reach",clicks:"Clicks",engagements:"Engagements",spend:"Spend",conversions:"Conversions",leads:"Leads",videoViews:"Video Views",viralImpressions:"Viral Impressions",users:"Users",sessions:"Sessions",pageviews:"Pageviews",avgSessionDuration:"Avg Session Duration",pagesPerSession:"Pages Per Session",bounceRate:"Bounce Rate",organicSearchShare:"Organic Search",directBrandedShare:"Direct/Branded",emailShare:"Email Share",referralShare:"Referral/Partners",paidShare:"Paid Display/Search",socialShare:"Social Media",emailsDelivered:"Emails Delivered",openRate:"Open Rate",clickThroughRate:"CTR",clickToOpenRate:"CTOR",hardBounces:"Hard Bounce Rate",spamComplaints:"Spam Complaint Rate",listGrowth:"List Growth"};
    const data = await csv("Metric,Value\n"+Object.entries(fields).map(([key,label])=>`${label},${key==="avgSessionDuration"?"00:00:00":key.endsWith("Share")?"0%":"0"}`).join("\n"));
    for(const key of Object.keys(fields)) expect(data[key as keyof typeof data]).toBe(key==="avgSessionDuration"?"00:00:00":0);
    expect(data._extractedFields).toBe(28);expect(data._requiresReview).toBe(false);
  });
  it("does not add distinct users or reach across unknown overlapping populations", async () => {
    const data = await csv("Users,Reach\n10,20\n10,20");
    expect(data.users).toBeUndefined();expect(data.reach).toBeUndefined();expect(data._requiresReview).toBe(true);
  });
  it("rejects missing selected values and ambiguous traffic shares", async () => {
    await expect(csv("Metric,Value\nSpend,100\nSpend,")).rejects.toThrow();
    await expect(csv("Spend,Clicks\n100,1\n,2")).rejects.toThrow();
    await expect(csv("Organic Search\n50")).rejects.toThrow("percentages");
  });

});


describe("Batch 4 actual multipart import budget", () => {
  it("accepts one report and rejects multiple attachments before the handler", async () => {
    const sf=ts.createSourceFile("routes.ts",readFileSync("server/routes-oauth.ts","utf8"),ts.ScriptTarget.Latest,true);
    let code="";const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(sf)==="upload"&&node.initializer)code=node.initializer.getText(sf);ts.forEachChild(node,visit);};visit(sf);
    expect(code).toContain("files: 1");
    const upload=new Function("multer","isSupportedCustomIntegrationFile","supportedCustomIntegrationFileDescription",ts.transpileModule(`return (${code});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(multer,isSupportedCustomIntegrationFile,supportedCustomIntegrationFileDescription);
    const app=express();let calls=0;
    app.post("/fixture",upload.any(),(req,res)=>{calls++;res.json({ok:true});});
    app.use((error:any,_req:any,res:any,_next:any)=>res.status(413).json({code:error.code}));
    const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
    try {
      const url=`http://127.0.0.1:${(server.address() as any).port}/fixture`;
      const one=new FormData();one.append("file",new Blob(["Spend\n100"],{type:"text/csv"}),"report.csv");
      expect((await fetch(url,{method:"POST",body:one})).status).toBe(200);
      const two=new FormData();for(const name of ["first","second"])two.append(name,new Blob(["Spend\n100"],{type:"text/csv"}),`${name}.csv`);
      const response=await fetch(url,{method:"POST",body:two});expect(response.status).toBe(413);expect(await response.json()).toMatchObject({code:"LIMIT_FILE_COUNT"});expect(calls).toBe(1);
    } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
});
