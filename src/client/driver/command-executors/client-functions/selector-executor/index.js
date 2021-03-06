import { Promise } from '../../../deps/hammerhead';
import { delay, positionUtils, domUtils } from '../../../deps/testcafe-core';
import { selectElement as selectElementUI } from '../../../deps/testcafe-ui';
import ClientFunctionExecutor from '../client-function-executor';
import { createReplicator, FunctionTransform, SelectorNodeTransform } from '../replicator';
import './filter';

const CHECK_ELEMENT_DELAY = 200;


// Utils
function exists (el) {
    return !!el;
}

function visible (el) {
    if (!domUtils.isDomElement(el) && !domUtils.isTextNode(el))
        return false;

    if (domUtils.isOptionElement(el) || domUtils.getTagName(el) === 'optgroup')
        return selectElementUI.isOptionElementVisible(el);

    return positionUtils.isElementVisible(el);
}

export default class SelectorExecutor extends ClientFunctionExecutor {
    constructor (command, globalTimeout, startTime, createNotFoundError, createIsInvisibleError) {
        super(command);

        this.createNotFoundError    = createNotFoundError;
        this.createIsInvisibleError = createIsInvisibleError;
        this.timeout                = typeof command.timeout === 'number' ? command.timeout : globalTimeout;
        this.counterMode            = this.dependencies.filterOptions.counterMode;

        if (startTime) {
            var elapsed = new Date() - startTime;

            this.timeout = Math.max(this.timeout - elapsed, 0);
        }

        var customDOMProperties = this.dependencies && this.dependencies.customDOMProperties;

        this.replicator.addTransforms([new SelectorNodeTransform(customDOMProperties)]);
    }

    _createReplicator () {
        return createReplicator([
            new FunctionTransform()
        ]);
    }

    _validateElement (args, startTime) {
        return Promise.resolve()
            .then(() => this.fn.apply(window, args))
            .then(el => {
                const isElementExists    = exists(el);
                const isElementVisible   = !this.command.visibilityCheck || visible(el);
                const createTimeoutError = !isElementExists ? this.createNotFoundError : this.createIsInvisibleError;
                const isTimeout          = new Date() - startTime >= this.timeout;

                if (isElementExists && isElementVisible)
                    return el;

                if (!isTimeout)
                    return delay(CHECK_ELEMENT_DELAY).then(() => this._validateElement(args, startTime));

                if (createTimeoutError)
                    throw createTimeoutError();

                return null;
            });
    }

    _executeFn (args) {
        if (this.counterMode)
            return super._executeFn(args);

        var startTime = new Date();
        var error     = null;
        var element   = null;

        return this
            ._validateElement(args, startTime)
            .catch(err => {
                error = err;
            })
            .then(el => {
                if (error)
                    throw error;

                element = el;
            })
            .then(() => element);
    }
}
