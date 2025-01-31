/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Config } from "./Config";
import { yellow } from "picocolors";

import express from "express";
import * as SentryNode from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import * as Integrations from "@sentry/integrations";

// Work around for when bundle calls api/etc
let errorHandlersUsed = false;

export const Sentry = {
	/** Call BEFORE registering your routes */
	init: async (app?: express.Application) => {
		const { enabled, endpoint, traceSampleRate, environment } =
			Config.get().sentry;
		if (!enabled) return;

		if (SentryNode.getCurrentHub().getClient()) return; // we've already initialised sentry

		console.log("[Sentry] Enabling sentry...");

		if (traceSampleRate >= 0.8) {
			console.log(
				`[Sentry] ${yellow(
					"Your sentry trace sampling rate is >= 80%. For large loads, this may degrade performance.",
				)}`,
			);
		}

		SentryNode.init({
			dsn: endpoint,
			integrations: [
				new SentryNode.Integrations.Http({ tracing: true }),
				new Tracing.Integrations.Express({ app }),
				new Tracing.Integrations.Mysql(),
				new Integrations.RewriteFrames({
					root: __dirname,
				}),
			],
			tracesSampleRate: traceSampleRate, // naming?
			environment,
		});

		SentryNode.addGlobalEventProcessor((event) => {
			if (event.transaction) {
				// Rewrite things that look like IDs to `:id` for sentry
				event.transaction = event.transaction
					.split("/")
					.map((x) => (!parseInt(x) ? x : ":id"))
					.join("/");
			}

			// TODO: does this even do anything?
			delete event.request?.cookies;
			if (event.request?.headers) {
				delete event.request.headers["X-Real-Ip"];
				delete event.request.headers["X-Forwarded-For"];
				delete event.request.headers["X-Forwarded-Host"];
				delete event.request.headers["X-Super-Properties"];
			}

			if (event.breadcrumbs) {
				event.breadcrumbs = event.breadcrumbs.filter((x) => {
					// Filter breadcrumbs that we don't care about
					if (x.message?.includes("identified as")) return false;
					if (x.message?.includes("[WebSocket] closed")) return false;
					if (
						x.message?.includes(
							"Got Resume -> cancel not implemented",
						)
					)
						return false;
					if (x.message?.includes("[Gateway] New connection from"))
						return false;

					return true;
				});
			}

			return event;
		});

		if (app) {
			app.use(SentryNode.Handlers.requestHandler());
			app.use(SentryNode.Handlers.tracingHandler());
		}
	},

	/** Call AFTER registering your routes */
	errorHandler: (app: express.Application) => {
		if (!Config.get().sentry.enabled) return;
		if (errorHandlersUsed) return;
		errorHandlersUsed = true;

		app.use(SentryNode.Handlers.errorHandler());
		// The typings for this are broken?
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
		app.use(function onError(err: any, req: any, res: any, next: any) {
			res.statusCode = 500;
			res.end(res.sentry + "\n");
		});
	},

	close: () => {
		SentryNode.close();
	},
};
