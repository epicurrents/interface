/**
 * Epicurrents Interface global property types.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

/* eslint-disable */
/**
 * Python scripts to be used with Pyodide service.
 */
declare module "*.py" {
    const content: string
    export default content
}
