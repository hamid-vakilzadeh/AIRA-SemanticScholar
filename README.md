[![smithery badge](https://smithery.ai/badge/@hamid-vakilzadeh/mcpsemanticscholar)](https://smithery.ai/server/@hamid-vakilzadeh/mcpsemanticscholar)

# AI - Research Assistant

> The MCP project extends the work we started in our academic paper on using AI as a research assistant. In that paper, we focused on [retrieval-augmented generation (RAG) as a practical approach to support research tasks](http://lit-review-assistant.streamlit.app/). By the time the paper was published, we had already moved forward with MCP, which takes the core ideas further and delivers a more capable system. While MCP isn’t covered in the paper, it continues the same effort and reflects what we learned along the way.
>
> If you’re referencing this project, please also cite the following paper to acknowledge the original research:
>
> <strong>Vakilzadeh, H., and Wood, D. A. (2025). The Development of a RAG-Based Artificial Intelligence Research Assistant (AIRA). <em>Journal of Information Systems forthcoming</em>.</strong>

## Installation

First, make sure you've downloaded and installed the [Claude Desktop app](https://claude.ai/download) and you have [node.js](https://nodejs.org/en).

To install this MCP Server via [Smithery](https://smithery.ai/server/@hamid-vakilzadeh/mcpsemanticscholar) open your terminal/CMD and run the following command:

```bash
npx -y @smithery/cli@latest install @hamid-vakilzadeh/mcpsemanticscholar --client claude
```

Finally, restart Claude Desktop and the MCP should apper in `search and tools`.

> **Note:**
>
> - The API allows up to 100 requests per 5 minutes. To access a higher rate limit, visit [Semantic Scholar](https://www.semanticscholar.org/product/api#Partner-Form) to request authentication for your project.

## Semantic Scholar MCP Server

A Model Context Protocol (MCP) server that provides AI models with comprehensive access to the Semantic Scholar Academic Graph API. This server enables intelligent literature search, paper analysis, and citation network exploration through a robust set of tools, resources, and prompts.

## Features

### 🔍 **Comprehensive Paper Search**

- **Basic Search**: Simple keyword-based paper discovery
- **Advanced Search**: Multi-filter search with year ranges, citation thresholds, field of study filters, and publication type restrictions
- **Title Matching**: Find papers by closest title match with confidence scoring
- **Batch Operations**: Retrieve multiple papers efficiently (up to 500 papers per request)

### 👥 **Author Discovery & Analysis**

- Search authors by name or affiliation
- Retrieve detailed author profiles with metrics (h-index, citation counts, paper counts)
- Access complete publication lists for any author

### 📊 **Citation Network Analysis**

- Explore papers that cite a specific work
- Analyze reference lists and citation patterns
- Multi-depth citation network traversal for comprehensive impact analysis

### 📚 **Field-Specific Research**

- Browse top papers by academic field
- Filter research by publication venues
- Access open access publications specifically
