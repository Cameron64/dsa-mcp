import { createBylawsReadTool } from './bylaws-read.js';
import { createEducationListTool } from './education-list.js';
import { createEducationReadTool } from './education-read.js';
import { createInfraReferenceTool } from './infra-reference.js';
import { createResolutionsListTool } from './resolutions-list.js';
import { createResolutionsReadTool } from './resolutions-read.js';
import type { DsaMcpTool, DsaToolContext } from './tool-types.js';
import { createWikiDocumentReadTool } from './wiki-document.js';
import { createWikiSearchTool } from './wiki-search.js';

/**
 * The single registration list. Adding a tool = create src/tools/<name>.ts
 * with a defineDsaTool factory + add one line here.
 */
export function buildAllDsaTools(context: DsaToolContext): DsaMcpTool[] {
  return [
    createWikiSearchTool(context),
    createWikiDocumentReadTool(context),
    createBylawsReadTool(context),
    createResolutionsListTool(context),
    createResolutionsReadTool(context),
    createEducationListTool(context),
    createEducationReadTool(context),
    createInfraReferenceTool(),
  ];
}
