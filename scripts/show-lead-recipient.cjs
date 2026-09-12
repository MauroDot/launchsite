/* eslint-disable @typescript-eslint/no-require-imports -- standalone diagnostic script. */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const projectId = process.argv[2];
if (!projectId) { console.error("Usage: node scripts/show-lead-recipient.cjs <project-id>"); process.exitCode = 1; return; }
(async () => { const prisma = new PrismaClient(); try { const project = await prisma.websiteProject.findUnique({ where: { id: projectId }, select: { id: true, businessName: true, email: true, user: { select: { email: true } } } }); if (!project) throw new Error("Project not found."); console.log(JSON.stringify({ projectId: project.id, businessName: project.businessName, projectContactEmail: project.email || null, ownerEmail: project.user?.email || null, selectedRecipient: project.email?.trim() || project.user?.email?.trim() || null }, null, 2)); } finally { await prisma.$disconnect(); } })().catch((error) => { console.error(error instanceof Error ? error.message : "Unable to inspect lead recipient."); process.exitCode = 1; });
