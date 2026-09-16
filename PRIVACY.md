# Privacy

This plugin is a set of configuration files and instructions. It does not collect, store or send any data of its own.

## What happens to data

- Your AI client connects only to the Corebee endpoints listed in the [README](README.md#data-and-privacy). The sign-in and consent pages it opens in your browser are ordinary Corebee web pages, covered by Corebee's Privacy Policy and Cookie Policy.
- Tool results, such as customer conversations and contact details from your Corebee workspace, are returned to your AI client. The client and its model provider handle them under their own terms.
- `export_report` returns contact names, emails and phone numbers only with `format: json`. The default `summary` format returns counts.
- `a2a_knowledge_agent` sends the text you pass it (with any `history`) and up to 5 matching knowledge base passages to Corebee's AI providers to write its answer. The other three assistant tools (`a2a_escalation_agent`, `a2a_diagnostic_agent` and `a2a_action_agent`) apply fixed keyword rules inside Corebee and send nothing to an AI provider.
- Corebee processes your workspace data under its [Privacy Policy](https://corebee.ai/privacy), [Terms of Service](https://corebee.ai/terms) and [Data Processing Agreement](https://corebee.ai/dpa).
- Corebee's Terms of Service include a "No training on your data" commitment, and its Privacy Policy states that Corebee contractually prohibits its AI providers from using customer data to train their models. This covers the AI providers Corebee uses. It does not cover the AI client or model provider you connect this plugin to.

## Contact

Privacy questions: <jonathan@corebee.ai> (the contact named in Corebee's [Privacy Policy](https://corebee.ai/privacy); data protection inquiries can also go to <privacy@corebee.ai>)
