#!/usr/bin/env node
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import {
  searchPapers,
  matchPaper,
  getPaper,
  getPaperCitations,
  getPaperReferences,
  getPapersBatch,
  searchAuthors,
  getAuthor,
  getAuthorPapers,
} from "./lib/api/semanticScholar/endpoints.js";
import { createFilter } from "./lib/api/semanticScholar/filters.js";
import { Paper, Author } from "./lib/api/semanticScholar/types.js";

/**
 * Semantic Scholar MCP Server
 *
 * This server provides access to the Semantic Scholar Academic Graph,
 * allowing AI models to search for papers, authors, and analyze citation networks.
 *
 * The server exposes resources, tools, and prompts for interacting with academic literature.
 */
export const configSchema = z.object({
  apiKey: z.string().describe("Your Semantic Scholar API key"),
  wileyToken: z
    .string()
    .optional()
    .describe("Your Wiley TDM Client Token for downloading papers"),
  debug: z.boolean().default(false).describe("Enable debug logging"),
});

export function createStatelessServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: "AI Research Assistant",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  });

  /**
   * Helper Functions
   *
   * These functions format data from the Semantic Scholar API into
   * human-readable text for display in the MCP tools and resources.
   */

  /**
   * Format a paper object into a readable string
   */
  const formatPaper = (paper: Paper): string => {
    let result = `Title: ${paper.title}\n`;
    if (paper.authors && paper.authors.length > 0) {
      result += `Authors: ${paper.authors.map((a) => a.name).join(", ")}\n`;
    }
    if (paper.year) {
      result += `Year: ${paper.year}\n`;
    }
    if (paper.venue) {
      result += `Venue: ${paper.venue}\n`;
    }
    if (paper.publicationVenue?.name) {
      result += `Publisher: ${paper.publicationVenue.name}\n`;
    }
    if (paper.externalIds?.DOI) {
      result += `DOI: ${paper.externalIds.DOI}\n`;
    }
    if (paper.citationCount !== undefined) {
      result += `Citations: ${paper.citationCount}\n`;
    }
    if (paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0) {
      result += `Fields of Study: ${paper.fieldsOfStudy.join(", ")}\n`;
    }
    if (paper.abstract) {
      result += `\nAbstract: ${paper.abstract}\n`;
    }
    if (paper.url) {
      result += `\nURL: ${paper.url}\n`;
    }
    if (paper.isOpenAccess) {
      result += `Open Access: Yes\n`;
      if (paper.openAccessPdf?.url) {
        result += `PDF: ${paper.openAccessPdf.url}\n`;
      }
    }
    return result;
  };

  /**
   * Format an author object into a readable string
   */
  const formatAuthor = (author: Author): string => {
    let result = `Name: ${author.name}\n`;
    if (author.affiliations && author.affiliations.length > 0) {
      result += `Affiliations: ${author.affiliations.join(", ")}\n`;
    }
    if (author.paperCount !== undefined) {
      result += `Papers: ${author.paperCount}\n`;
    }
    if (author.citationCount !== undefined) {
      result += `Citations: ${author.citationCount}\n`;
    }
    if (author.hIndex !== undefined) {
      result += `h-index: ${author.hIndex}\n`;
    }
    if (author.url) {
      result += `URL: ${author.url}\n`;
    }
    return result;
  };

  /**
   * RESOURCES
   *
   * These resources provide access to academic papers, authors, and fields of study
   * through URI templates that can be used to retrieve specific information.
   */

  /**
   * Paper Resource - Get detailed information about a specific paper by ID
   *
   * URI format: paper://{paperId}
   * Example: paper://649def34f8be52c8b66281af98ae884c09aef38b
   */
  server.resource(
    "paper",
    new ResourceTemplate("paper://{paperId}", { list: undefined }),
    async (uri: URL, variables: Record<string, string | string[]>) => {
      try {
        const paperId = variables.paperId as string;
        const paper = await getPaper({
          paperId,
          fields:
            "paperId,title,abstract,year,venue,publicationVenue,externalIds,citationCount,authors,url,isOpenAccess,openAccessPdf,fieldsOfStudy",
        });

        return {
          contents: [
            {
              uri: uri.href,
              text: formatPaper(paper),
              mimeType: "text/plain",
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error retrieving paper: ${
                error instanceof Error ? error.message : String(error)
              }`,
              mimeType: "text/plain",
            },
          ],
        };
      }
    }
  );

  /**
   * Author Resource - Get detailed information about a specific author by ID
   *
   * URI format: author://{authorId}
   * Example: author://1741101
   */
  server.resource(
    "author",
    new ResourceTemplate("author://{authorId}", { list: undefined }),
    async (uri: URL, variables: Record<string, string | string[]>) => {
      try {
        const authorId = variables.authorId as string;
        const author = await getAuthor({
          authorId,
          fields:
            "authorId,name,affiliations,paperCount,citationCount,hIndex,url",
        });

        return {
          contents: [
            {
              uri: uri.href,
              text: formatAuthor(author),
              mimeType: "text/plain",
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error retrieving author: ${
                error instanceof Error ? error.message : String(error)
              }`,
              mimeType: "text/plain",
            },
          ],
        };
      }
    }
  );

  /**
   * Field of Study Resource - Get top papers in a specific academic field
   *
   * URI format: field://{fieldOfStudy}
   * Example: field://Computer Science
   */
  server.resource(
    "field",
    new ResourceTemplate("field://{fieldOfStudy}", { list: undefined }),
    async (uri: URL, variables: Record<string, string | string[]>) => {
      try {
        const fieldOfStudy = variables.fieldOfStudy as string;
        const filter = createFilter("")
          .withFieldsOfStudy([fieldOfStudy])
          .withFields(["title", "authors", "year", "venue", "citationCount"])
          .withSort("citationCount", "desc")
          .withPagination(0, 10);

        // We need to add a query even though we're filtering by field
        filter.withQuery("*");

        const results = await searchPapers(filter);

        let text = `Top papers in ${fieldOfStudy}:\n\n`;
        results.data.forEach((paper, index) => {
          text += `${index + 1}. ${paper.title} (${paper.year || "N/A"})\n`;
          if (paper.authors && paper.authors.length > 0) {
            text += `   Authors: ${paper.authors
              .map((a) => a.name)
              .join(", ")}\n`;
          }
          if (paper.citationCount !== undefined) {
            text += `   Citations: ${paper.citationCount}\n`;
          }
          text += "\n";
        });

        return {
          contents: [
            {
              uri: uri.href,
              text,
              mimeType: "text/plain",
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error retrieving field papers: ${
                error instanceof Error ? error.message : String(error)
              }`,
              mimeType: "text/plain",
            },
          ],
        };
      }
    }
  );

  /**
   * TOOLS
   *
   * These tools provide functionality for searching and analyzing academic literature.
   * They are organized into categories for easier discovery and use.
   */

  /**
   * Paper Search and Retrieval Tools
   *
   * These tools allow searching for papers, retrieving paper details,
   * and finding papers by title match.
   */

  /**
   * Basic paper search with just a query and limit
   */
  server.tool(
    "papers-search-basic",
    "Search for academic papers with a simple query.",
    {
      query: z.string().describe("Search query for papers"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
    },
    async ({ query, limit }) => {
      try {
        const filter = createFilter(query)
          .withFields([
            "paperId",
            "title",
            "abstract",
            "authors",
            "year",
            "venue",
            "publicationVenue",
            "externalIds",
            "citationCount",
            "url",
            "isOpenAccess",
          ])
          .withPagination(0, limit || 10);

        const results = await searchPapers(filter);

        let response = "";

        // Show pagination info at the beginning
        if (results.next) {
          response += `**Note: More results available. To see the next page, use offset=${results.next} in your query.**\n\n`;
        }

        response += `Found ${results.total} papers matching "${query}"\n\n`;

        if (results.data.length === 0) {
          response += "No papers found matching your criteria.";
        } else {
          results.data.forEach((paper, index) => {
            response += `${index + 1}. ${paper.title} (${
              paper.year || "N/A"
            })\n`;
            if (paper.authors && paper.authors.length > 0) {
              response += `   Authors: ${paper.authors
                .map((a) => a.name)
                .join(", ")}\n`;
            }
            if (paper.venue) {
              response += `   Venue: ${paper.venue}\n`;
            }
            if (paper.publicationVenue?.name) {
              response += `   Publisher: ${paper.publicationVenue.name}\n`;
            }
            if (paper.citationCount !== undefined) {
              response += `   Citations: ${paper.citationCount}\n`;
            }
            if (paper.url) {
              response += `   URL: ${paper.url}\n`;
            }
            if (paper.externalIds) {
              response += `   DOI: ${paper.externalIds.DOI}\n`;
            }
            response += "\n";
          });

          if (results.next) {
            response += `\n**To see more results, use offset=${results.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching papers: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Advanced paper search with multiple filters
   */
  server.tool(
    "papers-search-advanced",
    "Search for academic papers with advanced filtering options",
    {
      query: z.string().describe("Search query for papers"),
      yearStart: z
        .number()
        .optional()
        .describe("Starting year for filtering (inclusive)"),
      yearEnd: z
        .number()
        .optional()
        .describe("Ending year for filtering (inclusive)"),
      minCitations: z
        .number()
        .optional()
        .describe("Minimum number of citations"),
      openAccessOnly: z
        .boolean()
        .optional()
        .describe("Only include open access papers"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
      fieldsOfStudy: z
        .array(z.string())
        .optional()
        .describe("Fields of study to filter by"),
      publicationTypes: z
        .array(z.string())
        .optional()
        .describe("Publication types to filter by"),
      sortBy: z
        .enum(["relevance", "citationCount", "year"])
        .optional()
        .default("relevance")
        .describe("Field to sort by"),
      sortOrder: z
        .enum(["asc", "desc"])
        .optional()
        .default("desc")
        .describe("Sort order"),
    },
    async ({
      query,
      yearStart,
      yearEnd,
      minCitations,
      openAccessOnly,
      limit,
      fieldsOfStudy,
      publicationTypes,
      sortBy,
      sortOrder,
    }) => {
      try {
        const filter = createFilter(query)
          .withFields([
            "paperId",
            "title",
            "abstract",
            "authors",
            "year",
            "venue",
            "publicationVenue",
            "externalIds",
            "citationCount",
            "url",
            "isOpenAccess",
          ])
          .withPagination(0, limit || 10);

        if (yearStart !== undefined || yearEnd !== undefined) {
          filter.withYearRange(yearStart, yearEnd);
        }

        if (minCitations !== undefined) {
          filter.withMinCitations(minCitations);
        }

        if (openAccessOnly) {
          filter.withOpenAccessOnly();
        }

        if (fieldsOfStudy && fieldsOfStudy.length > 0) {
          filter.withFieldsOfStudy(fieldsOfStudy);
        }

        if (publicationTypes && publicationTypes.length > 0) {
          filter.withPublicationTypes(publicationTypes);
        }

        if (sortBy) {
          filter.withSort(sortBy, sortOrder || "desc");
        }

        const results = await searchPapers(filter);

        let response = "";

        // Show pagination info at the beginning
        if (results.next) {
          response += `**Note: More results available. To see the next page, use offset=${results.next} in your query.**\n\n`;
        }

        response += `Found ${results.total} papers matching "${query}"\n\n`;

        if (results.data.length === 0) {
          response += "No papers found matching your criteria.";
        } else {
          results.data.forEach((paper, index) => {
            response += `${index + 1}. ${paper.title} (${
              paper.year || "N/A"
            })\n`;
            if (paper.authors && paper.authors.length > 0) {
              response += `   Authors: ${paper.authors
                .map((a) => a.name)
                .join(", ")}\n`;
            }
            if (paper.venue) {
              response += `   Venue: ${paper.venue}\n`;
            }
            if (paper.publicationVenue?.name) {
              response += `   Publisher: ${paper.publicationVenue.name}\n`;
            }
            if (paper.citationCount !== undefined) {
              response += `   Citations: ${paper.citationCount}\n`;
            }
            if (paper.url) {
              response += `   URL: ${paper.url}\n`;
            }
            if (paper.externalIds) {
              response += `   DOI: ${paper.externalIds.DOI}\n`;
            }

            if (paper.isOpenAccess) {
              response += `   Open Access: Yes\n`;
            }
            response += "\n";
          });

          if (results.next) {
            response += `\n**To see more results, use offset=${results.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching papers: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Find a paper by closest title match
   */
  server.tool(
    "search-paper-title",
    "Find a paper by closest title match",
    {
      title: z.string().describe("Paper title to match"),
      yearStart: z
        .number()
        .optional()
        .describe("Starting year for filtering (inclusive)"),
      yearEnd: z
        .number()
        .optional()
        .describe("Ending year for filtering (inclusive)"),
      minCitations: z
        .number()
        .optional()
        .describe("Minimum number of citations"),
      openAccessOnly: z
        .boolean()
        .optional()
        .describe("Only include open access papers"),
    },
    async ({
      title,
      yearStart,
      yearEnd,
      minCitations,
      openAccessOnly,
    }: {
      title: string;
      yearStart?: number;
      yearEnd?: number;
      minCitations?: number;
      openAccessOnly?: boolean;
    }) => {
      try {
        const filter = createFilter(title).withFields([
          "paperId",
          "title",
          "abstract",
          "authors",
          "year",
          "venue",
          "publicationVenue",
          "externalIds",
          "citationCount",
          "url",
          "isOpenAccess",
        ]);

        if (yearStart !== undefined || yearEnd !== undefined) {
          filter.withYearRange(yearStart, yearEnd);
        }

        if (minCitations !== undefined) {
          filter.withMinCitations(minCitations);
        }

        if (openAccessOnly) {
          filter.withOpenAccessOnly();
        }

        const matchParams = filter.buildMatchParams();
        const paper = await matchPaper(matchParams);

        // Debug: Check what we actually got back
        if (!paper || !paper.title) {
          console.error("Paper match returned incomplete data:", paper);
          return {
            content: [
              {
                type: "text",
                text: `Error: Paper match endpoint returned incomplete data. Please try a more specific search query.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: formatPaper(paper),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error matching paper: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Get detailed information about a specific paper
   */
  server.tool(
    "get-paper-abstract",
    "Get detailed information about a specific paper including its abstract",
    {
      paperId: z
        .string()
        .describe("Paper ID (Semantic Scholar ID, arXiv ID, DOI, etc.)"),
    },
    async ({ paperId }) => {
      try {
        const paper = await getPaper({
          paperId,
          fields:
            "paperId,title,abstract,year,venue,publicationVenue,externalIds,citationCount,authors,url,isOpenAccess,openAccessPdf,fieldsOfStudy",
        });

        return {
          content: [{ type: "text", text: formatPaper(paper) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving paper details: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Get papers that cite a specific paper
   */
  server.tool(
    "papers-citations",
    "Get papers that cite a specific paper",
    {
      paperId: z
        .string()
        .describe("Paper ID (Semantic Scholar ID, arXiv ID, DOI, etc.)"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of citations to return"),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Offset for pagination"),
    },
    async ({ paperId, limit, offset }) => {
      try {
        const citations = await getPaperCitations(
          { paperId },
          {
            offset: offset || 0,
            limit: limit || 10,
            fields:
              "paperId,title,abstract,year,venue,publicationVenue,citationCount,authors,url,isOpenAccess,contexts,isInfluential",
          }
        );

        let response = "";

        // Show pagination info at the beginning
        if (citations.next) {
          response += `**Note: More citations available. To see the next page, use offset=${citations.next} in your query.**\n\n`;
        }

        response += `Citations for paper ID ${paperId}:\n\n`;

        if (citations.data.length === 0) {
          response += "No citations found.";
        } else {
          citations.data.forEach((citation, index) => {
            response += `${index + 1}. ${citation.citingPaper.title} (${
              citation.citingPaper.year || "N/A"
            })\n`;
            if (
              citation.citingPaper.authors &&
              citation.citingPaper.authors.length > 0
            ) {
              response += `   Authors: ${citation.citingPaper.authors
                .map((a) => a.name)
                .join(", ")}\n`;
            }
            if (citation.isInfluential) {
              response += `   Influential: Yes\n`;
            }
            if (citation.citingPaper.url) {
              response += `   URL: ${citation.citingPaper.url}\n`;
            }
            response += "\n";
          });

          if (citations.next) {
            response += `\n**To see more citations, use offset=${citations.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving citations: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Get papers cited by a specific paper
   */
  server.tool(
    "papers-references",
    "Get papers cited by a specific paper",
    {
      paperId: z
        .string()
        .describe("Paper ID (Semantic Scholar ID, arXiv ID, DOI, etc.)"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of references to return"),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Offset for pagination"),
    },
    async ({ paperId, limit, offset }) => {
      try {
        const references = await getPaperReferences(
          { paperId },
          {
            offset: offset || 0,
            limit: limit || 10,
            fields:
              "paperId,title,abstract,year,venue,publicationVenue,citationCount,authors,url,isOpenAccess,contexts,isInfluential",
          }
        );

        let response = "";

        // Show pagination info at the beginning
        if (references.next) {
          response += `**Note: More references available. To see the next page, use offset=${references.next} in your query.**\n\n`;
        }

        response += `References for paper ID ${paperId}:\n\n`;

        if (references.data.length === 0) {
          response += "No references found.";
        } else {
          references.data.forEach((reference, index) => {
            response += `${index + 1}. ${reference.citedPaper.title} (${
              reference.citedPaper.year || "N/A"
            })\n`;
            if (
              reference.citedPaper.authors &&
              reference.citedPaper.authors.length > 0
            ) {
              response += `   Authors: ${reference.citedPaper.authors
                .map((a) => a.name)
                .join(", ")}\n`;
            }
            if (reference.isInfluential) {
              response += `   Influential: Yes\n`;
            }
            if (reference.citedPaper.url) {
              response += `   URL: ${reference.citedPaper.url}\n`;
            }
            response += "\n";
          });

          if (references.next) {
            response += `\n**To see more references, use offset=${references.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving references: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Search for authors by name or affiliation
   */
  server.tool(
    "authors-search",
    "Search for authors by name or affiliation",
    {
      query: z.string().describe("Search query for authors"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Offset for pagination"),
    },
    async ({ query, limit, offset }) => {
      try {
        const results = await searchAuthors({
          query,
          offset: offset || 0,
          limit: limit || 10,
          fields:
            "authorId,name,affiliations,paperCount,citationCount,hIndex,url",
        });

        let response = "";

        // Show pagination info at the beginning
        if (results.next) {
          response += `**Note: More authors available. To see the next page, use offset=${results.next} in your query.**\n\n`;
        }

        response += `Found ${results.total} authors matching "${query}"\n\n`;

        if (results.data.length === 0) {
          response += "No authors found matching your criteria.";
        } else {
          results.data.forEach((author, index) => {
            response += `${index + 1}. ${author.name}\n`;
            if (author.affiliations && author.affiliations.length > 0) {
              response += `   Affiliations: ${author.affiliations.join(
                ", "
              )}\n`;
            }
            if (author.paperCount !== undefined) {
              response += `   Papers: ${author.paperCount}\n`;
            }
            if (author.citationCount !== undefined) {
              response += `   Citations: ${author.citationCount}\n`;
            }
            if (author.hIndex !== undefined) {
              response += `   h-index: ${author.hIndex}\n`;
            }
            if (author.url) {
              response += `   URL: ${author.url}\n`;
            }
            response += "\n";
          });

          if (results.next) {
            response += `\n**To see more authors, use offset=${results.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching authors: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Get papers written by a specific author
   */
  server.tool(
    "authors-papers",
    "Get papers written by a specific author",
    {
      authorId: z.string().describe("Author ID"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of papers to return"),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Offset for pagination"),
    },
    async ({ authorId, limit, offset }) => {
      try {
        const papers = await getAuthorPapers(
          { authorId },
          {
            offset: offset || 0,
            limit: limit || 10,
            fields:
              "paperId,title,abstract,year,venue,publicationVenue,citationCount,authors,url,isOpenAccess",
          }
        );

        let response = "";

        // Show pagination info at the beginning
        if (papers.next) {
          response += `**Note: More papers available. To see the next page, use offset=${papers.next} in your query.**\n\n`;
        }

        response += `Papers by author ID ${authorId}:\n\n`;

        if (papers.data.length === 0) {
          response += "No papers found.";
        } else {
          papers.data.forEach((paper, index) => {
            response += `${index + 1}. ${paper.title} (${
              paper.year || "N/A"
            })\n`;
            if (paper.venue) {
              response += `   Venue: ${paper.venue}\n`;
            }
            if (paper.publicationVenue?.name) {
              response += `   Publisher: ${paper.publicationVenue.name}\n`;
            }
            if (paper.citationCount !== undefined) {
              response += `   Citations: ${paper.citationCount}\n`;
            }
            if (paper.url) {
              response += `   URL: ${paper.url}\n`;
            }
            response += "\n";
          });

          if (papers.next) {
            response += `\n**To see more papers, use offset=${papers.next} in your next query.**`;
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving author papers: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Look up multiple papers by their IDs
   */
  server.tool(
    "papers-batch",
    "Look up multiple papers by their IDs",
    {
      paperIds: z
        .array(z.string())
        .describe(
          "Array of paper IDs (Semantic Scholar IDs, arXiv IDs, DOIs, etc.)"
        ),
    },
    async ({ paperIds }) => {
      try {
        if (paperIds.length === 0) {
          return {
            content: [{ type: "text", text: "No paper IDs provided." }],
            isError: true,
          };
        }

        if (paperIds.length > 500) {
          return {
            content: [
              { type: "text", text: "Too many paper IDs. Maximum is 500." },
            ],
            isError: true,
          };
        }

        const papers = await getPapersBatch({
          ids: paperIds,
          // fields: "paperId,title,abstract,year,venue,citationCount,authors,url,isOpenAccess"
          fields: "title,authors,citations.title,citations.abstract",
        });

        let response = `Batch lookup results for ${paperIds.length} papers:\n\n`;

        if (papers.length === 0) {
          response += "No papers found.";
        } else {
          papers.forEach((paper, index) => {
            if (!paper) {
              response += `${index + 1}. [Not found]\n\n`;
              return;
            }

            response += `${index + 1}. ${paper.title} (${
              paper.year || "N/A"
            })\n`;
            if (paper.authors && paper.authors.length > 0) {
              response += `   Authors: ${paper.authors
                .map((a) => a.name)
                .join(", ")}\n`;
            }
            if (paper.venue) {
              response += `   Venue: ${paper.venue}\n`;
            }
            if (paper.publicationVenue?.name) {
              response += `   Publisher: ${paper.publicationVenue.name}\n`;
            }
            if (paper.citationCount !== undefined) {
              response += `   Citations: ${paper.citationCount}\n`;
            }
            if (paper.url) {
              response += `   URL: ${paper.url}\n`;
            }
            response += "\n";
          });
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error in batch paper lookup: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Download full-text PDF from Wiley and convert to text
   */
  server.tool(
    "download-full-paper-wiley",
    "Download full-text PDF of a Wiley paper using its DOI and extract text content (memory only)",
    {
      doi: z
        .string()
        .describe(
          "DOI of the paper to download (e.g., 10.1111/1467-923X.12168)"
        ),
    },
    async ({ doi }) => {
      try {
        // Check if Wiley token is configured
        if (!config.wileyToken) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Error: Wiley TDM Client Token not configured.\n\n" +
                  "Tell the user to download full-text PDFs from Wiley, you need to:\n" +
                  "1. Visit: https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining\n" +
                  "2. Accept the Wiley terms and conditions for Text and Data Mining\n" +
                  "3. Obtain your TDM Client Token\n" +
                  "4. Set the WILEY_TDM_CLIENT_TOKEN environment variable\n\n" +
                  "Note: You must have institutional access or subscription to the content you want to download.\n" +
                  "Academic subscribers can access subscribed content for non-commercial research purposes at no extra cost.",
              },
            ],
            isError: true,
          };
        }

        // Encode DOI for URL (replace / with %2F)
        const encodedDoi = encodeURIComponent(doi);
        const downloadUrl = `https://api.wiley.com/onlinelibrary/tdm/v1/articles/${encodedDoi}`;

        // Make request with Wiley token - Wiley always returns PDFs
        const response = await axios.get(downloadUrl, {
          headers: {
            "Wiley-TDM-Client-Token": config.wileyToken,
            Accept: "application/pdf",
          },
          responseType: "arraybuffer",
          maxRedirects: 5, // Follow redirects as required by Wiley
          timeout: 60000, // 60 second timeout for large files
        });

        // Buffer the entire response in memory
        const pdfBuffer = Buffer.from(response.data);

        // Extract text using pdfjs-dist (Mozilla's PDF.js library)
        try {
          // Set up DOM polyfills for Node.js environment
          const DOMMatrixModule = await import("@thednp/dommatrix");
          (global as any).DOMMatrix = DOMMatrixModule.default;

          // Ensure Promise.withResolvers is available (polyfill if needed)
          if (!Promise.withResolvers) {
            (Promise as any).withResolvers = function () {
              let resolve, reject;
              const promise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
              });
              return { promise, resolve, reject };
            };
          }

          // Redirect pdfjs-dist warnings from stdout to stderr
          const originalWrite = process.stdout.write;
          process.stdout.write = function (chunk: any) {
            if (typeof chunk === "string" && chunk.includes("Warning:")) {
              process.stderr.write(chunk);
              return true;
            }
            return originalWrite.call(process.stdout, chunk);
          };

          const pdfjsLib = await import("pdfjs-dist");

          // Restore original stdout
          process.stdout.write = originalWrite;

          // Convert Buffer to Uint8Array as required by pdfjs-dist
          const uint8Array = new Uint8Array(pdfBuffer);

          // Load PDF from Uint8Array
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
          const pdfDoc = await loadingTask.promise;

          let extractedText = "";

          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Combine text items from the page
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");

            extractedText += pageText + "\n\n";
          }

          // Clean up the extracted text
          const cleanText = extractedText.trim();

          if (!cleanText || cleanText.length < 50) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `PDF downloaded successfully but contains minimal text content.\n` +
                    `This may be a scanned PDF or contain mostly images.\n` +
                    `Extracted content length: ${cleanText.length} characters`,
                },
              ],
            };
          }

          // Return the extracted text
          return {
            content: [
              {
                type: "text",
                text: cleanText,
              },
            ],
          };
        } catch (parseError) {
          return {
            content: [
              {
                type: "text",
                text:
                  `PDF download succeeded but text extraction failed.\n` +
                  `Error: ${
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError)
                  }`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        // Handle specific Wiley API errors
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 400) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Error 400: No TDM Client Token was found in the request.\n\n" +
                    "Please visit https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining " +
                    "to obtain your Wiley TDM Client Token and configure it properly.",
                },
              ],
              isError: true,
            };
          }
          if (error.response?.status === 403) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Error 403: The Wiley TDM Client Token is invalid or not registered.\n\n" +
                    "Your token may be:\n" +
                    "- Incorrectly formatted\n" +
                    "- Expired or revoked\n" +
                    "- Not properly registered with Wiley\n\n" +
                    "Please visit https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining " +
                    "to verify your token or obtain a new one.",
                },
              ],
              isError: true,
            };
          }
          if (error.response?.status === 404) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `Error 404: Access denied for DOI ${doi}\n\n` +
                    "This means:\n" +
                    "- Your institution doesn't have a subscription to this content\n" +
                    "- The content is not open access\n" +
                    "- The DOI may be incorrect or the article doesn't exist\n\n" +
                    "Contact your institution's library to verify access rights or check if " +
                    "alternative versions of the paper are available through other sources.",
                },
              ],
              isError: true,
            };
          }
          if (error.response?.status === 429) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Error 429: Rate limit exceeded\n\n" +
                    "Wiley's API limits are:\n" +
                    "- Maximum 3 articles per second\n" +
                    "- Maximum 60 requests per 10 minutes\n\n" +
                    "Please wait before making additional requests. Consider implementing " +
                    "delays between requests to stay within the rate limits.",
                },
              ],
              isError: true,
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Error downloading paper: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Analyze the citation network for a specific paper
   */
  server.tool(
    "analysis-citation-network",
    "Analyze the citation network for a specific paper",
    {
      paperId: z
        .string()
        .describe("Paper ID (Semantic Scholar ID, arXiv ID, DOI, etc.)"),
      depth: z
        .string()
        .optional()
        .describe("Depth of citation network (1 or 2)"),
      citationsLimit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of citations to analyze per paper"),
      referencesLimit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of references to analyze per paper"),
    },
    async ({ paperId, depth, citationsLimit, referencesLimit }) => {
      try {
        // Get the main paper
        const paper = await getPaper({
          paperId,
          fields: "paperId,title,year,authors,citationCount,venue",
        });

        // Get citations
        const citations = await getPaperCitations(
          { paperId },
          {
            limit: citationsLimit || 10,
            fields: "paperId,title,year,authors,citationCount,isInfluential",
          }
        );

        // Get references
        const references = await getPaperReferences(
          { paperId },
          {
            limit: referencesLimit || 10,
            fields: "paperId,title,year,authors,citationCount,isInfluential",
          }
        );

        let response = `Citation Network Analysis for "${paper.title}" (${
          paper.year || "N/A"
        })\n\n`;

        // Main paper info
        response += `Main Paper: ${paper.title} (${paper.year || "N/A"})\n`;
        if (paper.authors && paper.authors.length > 0) {
          response += `Authors: ${paper.authors
            .map((a) => a.name)
            .join(", ")}\n`;
        }
        if (paper.venue) {
          response += `Venue: ${paper.venue}\n`;
        }
        if (paper.citationCount !== undefined) {
          response += `Citation Count: ${paper.citationCount}\n`;
        }
        response += "\n";

        // Citations analysis
        response += `PAPERS THAT CITE THIS PAPER (${citations.data.length}):\n\n`;

        if (citations.data.length === 0) {
          response += "No citations found.\n\n";
        } else {
          // Count influential citations
          const influentialCount = citations.data.filter(
            (c) => c.isInfluential
          ).length;
          response += `Influential Citations: ${influentialCount} of ${
            citations.data.length
          } (${Math.round(
            (influentialCount / citations.data.length) * 100
          )}%)\n\n`;

          // List top citations
          citations.data
            .sort(
              (a, b) =>
                (b.citingPaper.citationCount || 0) -
                (a.citingPaper.citationCount || 0)
            )
            .slice(0, 5)
            .forEach((citation, index) => {
              response += `${index + 1}. ${citation.citingPaper.title} (${
                citation.citingPaper.year || "N/A"
              })\n`;
              if (
                citation.citingPaper.authors &&
                citation.citingPaper.authors.length > 0
              ) {
                response += `   Authors: ${citation.citingPaper.authors
                  .map((a) => a.name)
                  .join(", ")}\n`;
              }
              if (citation.citingPaper.citationCount !== undefined) {
                response += `   Citations: ${citation.citingPaper.citationCount}\n`;
              }
              if (citation.isInfluential) {
                response += `   Influential: Yes\n`;
              }
              response += "\n";
            });
        }

        // References analysis
        response += `PAPERS CITED BY THIS PAPER (${references.data.length}):\n\n`;

        if (references.data.length === 0) {
          response += "No references found.\n\n";
        } else {
          // Count influential references
          const influentialCount = references.data.filter(
            (r) => r.isInfluential
          ).length;
          response += `Influential References: ${influentialCount} of ${
            references.data.length
          } (${Math.round(
            (influentialCount / references.data.length) * 100
          )}%)\n\n`;

          // List top references
          references.data
            .sort(
              (a, b) =>
                (b.citedPaper.citationCount || 0) -
                (a.citedPaper.citationCount || 0)
            )
            .slice(0, 5)
            .forEach((reference, index) => {
              response += `${index + 1}. ${reference.citedPaper.title} (${
                reference.citedPaper.year || "N/A"
              })\n`;
              if (
                reference.citedPaper.authors &&
                reference.citedPaper.authors.length > 0
              ) {
                response += `   Authors: ${reference.citedPaper.authors
                  .map((a) => a.name)
                  .join(", ")}\n`;
              }
              if (reference.citedPaper.citationCount !== undefined) {
                response += `   Citations: ${reference.citedPaper.citationCount}\n`;
              }
              if (reference.isInfluential) {
                response += `   Influential: Yes\n`;
              }
              response += "\n";
            });
        }

        // Second-level analysis if depth > 1
        if (depth && depth === "2") {
          // Get the most influential citation
          const topCitation = citations.data
            .sort(
              (a, b) =>
                (b.citingPaper.citationCount || 0) -
                (a.citingPaper.citationCount || 0)
            )
            .find((c) => c.isInfluential);

          if (topCitation) {
            response += `SECOND-LEVEL ANALYSIS: Papers that cite the most influential citation\n\n`;

            try {
              const secondLevelCitations = await getPaperCitations(
                { paperId: topCitation.citingPaper.paperId },
                {
                  limit: 5,
                  fields:
                    "paperId,title,year,authors,citationCount,isInfluential",
                }
              );

              if (secondLevelCitations.data.length === 0) {
                response += "No second-level citations found.\n\n";
              } else {
                secondLevelCitations.data
                  .sort(
                    (a, b) =>
                      (b.citingPaper.citationCount || 0) -
                      (a.citingPaper.citationCount || 0)
                  )
                  .forEach((citation, index) => {
                    response += `${index + 1}. ${citation.citingPaper.title} (${
                      citation.citingPaper.year || "N/A"
                    })\n`;
                    if (
                      citation.citingPaper.authors &&
                      citation.citingPaper.authors.length > 0
                    ) {
                      response += `   Authors: ${citation.citingPaper.authors
                        .map((a) => a.name)
                        .join(", ")}\n`;
                    }
                    if (citation.citingPaper.citationCount !== undefined) {
                      response += `   Citations: ${citation.citingPaper.citationCount}\n`;
                    }
                    response += "\n";
                  });
              }
            } catch (error) {
              response += `Error retrieving second-level citations: ${
                error instanceof Error ? error.message : String(error)
              }\n\n`;
            }
          }
        }

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing citation network: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // PROMPTS

  // Literature review prompt
  server.prompt(
    "literature-review",
    "Conduct a literature review on a research topic",
    {
      topic: z.string().describe("Research topic for literature review"),
      yearStart: z
        .string()
        .optional()
        .describe("Starting year for filtering (inclusive)"),
      yearEnd: z
        .string()
        .optional()
        .describe("Ending year for filtering (inclusive)"),
      fieldsOfStudy: z
        .string()
        .optional()
        .describe("Fields of study to filter by (comma-separated)"),
    },
    (args) => {
      const { topic, yearStart, yearEnd, fieldsOfStudy } = args;
      let promptText = `Please conduct a literature review on the topic: "${topic}"\n\n`;

      if (yearStart || yearEnd) {
        promptText += `Focus on literature from ${yearStart || ""} to ${
          yearEnd || "present"
        }.\n\n`;
      }

      if (fieldsOfStudy) {
        promptText += `Consider research in the following fields: ${fieldsOfStudy}.\n\n`;
      }

      promptText += `For this literature review, please:\n`;
      promptText += `1. Identify key papers and their contributions\n`;
      promptText += `2. Summarize major findings and methodologies\n`;
      promptText += `3. Identify trends, patterns, and gaps in the research\n`;
      promptText += `4. Suggest potential directions for future research\n\n`;
      promptText += `Use the Semantic Scholar tools to search for relevant papers and analyze citation networks.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );

  // Citation analysis prompt
  server.prompt(
    "citation-analysis",
    "Analyze the citation network for a specific paper",
    {
      paperId: z
        .string()
        .describe("Paper ID (Semantic Scholar ID, arXiv ID, DOI, etc.)"),
      depth: z
        .string()
        .optional()
        .describe("Depth of citation analysis (1 or 2)"),
    },
    (args) => {
      const { paperId, depth } = args;
      let promptText = `Please analyze the citation network for the paper with ID: ${paperId}\n\n`;

      if (depth && depth === "2") {
        promptText += `Include a second-level analysis of citations.\n\n`;
      }

      promptText += `For this citation analysis, please:\n`;
      promptText += `1. Identify the most influential papers that cite this work\n`;
      promptText += `2. Analyze how this paper has influenced different research areas\n`;
      promptText += `3. Identify potential research collaborations based on citation patterns\n`;
      promptText += `4. Summarize the overall impact of this paper on the field\n\n`;
      promptText += `Use the Semantic Scholar tools to retrieve paper details and analyze the citation network.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );

  // Research gap finder prompt
  server.prompt(
    "research-gap-finder",
    "Identify research gaps in a specific topic",
    {
      topic: z.string().describe("Research topic to analyze for gaps"),
      yearStart: z
        .string()
        .optional()
        .describe("Starting year for filtering (inclusive)"),
      yearEnd: z
        .string()
        .optional()
        .describe("Ending year for filtering (inclusive)"),
    },
    (args) => {
      const { topic, yearStart, yearEnd } = args;
      let promptText = `Please identify research gaps in the topic: "${topic}"\n\n`;

      if (yearStart || yearEnd) {
        promptText += `Focus on literature from ${yearStart || ""} to ${
          yearEnd || "present"
        }.\n\n`;
      }

      promptText += `For this analysis, please:\n`;
      promptText += `1. Identify the main research questions being addressed in this field\n`;
      promptText += `2. Determine which questions have been thoroughly explored\n`;
      promptText += `3. Identify questions that have received limited attention\n`;
      promptText += `4. Suggest specific research gaps that could be addressed in future work\n`;
      promptText += `5. Recommend methodologies or approaches for addressing these gaps\n\n`;
      promptText += `Use the Semantic Scholar tools to search for relevant papers and analyze the current state of research.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );
  return server.server;
}

// Start the server
async function main() {
  const server = createStatelessServer({
    config: {
      apiKey: process.env.SEMANTIC_SCHOLAR_API_KEY || "",
      wileyToken: process.env.WILEY_TDM_CLIENT_TOKEN || undefined,
      debug: process.env.DEBUG === "false",
    },
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Semantic Scholar MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
