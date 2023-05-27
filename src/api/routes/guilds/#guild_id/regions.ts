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

import { getIpAdress, getVoiceRegions, route } from "@spacebar/api";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router();

router.get(
	"/",
	route({
		responses: {
			200: {
				body: "APIGuildVoiceRegion",
			},
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { guild_id } = req.params;
		const guild = await Guild.findOneOrFail({ where: { id: guild_id } });
		//TODO we should use an enum for guild's features and not hardcoded strings
		return res.json(
			await getVoiceRegions(
				getIpAdress(req),
				guild.features.includes("VIP_REGIONS"),
			),
		);
	},
);

export default router;
