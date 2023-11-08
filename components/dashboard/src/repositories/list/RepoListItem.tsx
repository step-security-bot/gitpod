/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { usePrettyRepoURL } from "../../hooks/use-pretty-repo-url";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Text } from "@podkit/typography/Text";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

type Props = {
    configuration: Configuration;
};
export const RepositoryListItem: FC<Props> = ({ configuration }) => {
    const url = usePrettyRepoURL(configuration.cloneUrl);

    return (
        <tr key={configuration.id} className="flex flex-row w-full space-between items-center">
            <td className="">
                <Text className="font-semibold">{configuration.name}</Text>
            </td>
            <td>
                <TextMuted className="text-sm">{url}</TextMuted>
            </td>
            <td>
                {configuration.creationTime
                    ?.toDate()
                    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </td>

            <div>
                <Link to={`/repositories/${configuration.id}`}>
                    <Button type="secondary">View</Button>
                </Link>
            </div>
        </tr>
    );
};
