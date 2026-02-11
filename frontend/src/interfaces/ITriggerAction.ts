export interface IAction {
    /**
     * Executes the action.
     * @param context Optional data context (e.g. which detector triggered this)
     */
    execute(context?: any): void;
}