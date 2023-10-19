/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, ProjectEnvVar } from "@gitpod/gitpod-protocol";
import { useCallback, useEffect, useState } from "react";
import { getGitpodService } from "../../service/service";
import { Heading2, Subheading } from "@podkit/typography/headings";
import { useSetProjectEnvVar } from "../../data/projects/set-project-env-var-mutation";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import Alert from "../../components/Alert";
import { CheckboxInputField } from "../../components/forms/CheckboxInputField";
import InfoBox from "../../components/InfoBox";
import { Button } from "../../components/Button";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../../components/ItemsList";

interface ConfigurationVariablesProps {
    configuration: Project;
}

export default function ConfigurationEnvironmentVariables({ configuration }: ConfigurationVariablesProps) {
    const [envVars, setEnvVars] = useState<ProjectEnvVar[]>([]);
    const [showAddVariableModal, setShowAddVariableModal] = useState<boolean>(false);

    const updateEnvVars = async () => {
        const vars = await getGitpodService().server.getProjectEnvironmentVariables(configuration.id);
        const sortedVars = vars.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
        setEnvVars(sortedVars);
    };

    useEffect(() => {
        updateEnvVars();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configuration]);

    const deleteEnvVar = async (variableId: string) => {
        await getGitpodService().server.deleteProjectEnvironmentVariable(variableId);
        updateEnvVars();
    };

    return (
        <section>
            {showAddVariableModal && (
                <AddVariableModal
                    configuration={configuration}
                    onClose={() => {
                        updateEnvVars();
                        setShowAddVariableModal(false);
                    }}
                />
            )}
            <div className="mb-2 flex">
                <div className="flex-grow">
                    <Heading2>Environment Variables</Heading2>
                    <Subheading>Manage project-specific environment variables.</Subheading>
                </div>
                {envVars.length > 0 && <button onClick={() => setShowAddVariableModal(true)}>New Variable</button>}
            </div>
            {envVars.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center justify-center space-y-3">
                    <Heading2 color="light">No Environment Variables</Heading2>
                    <Subheading className="text-center w-96">
                        All <strong>project-specific environment variables</strong> will be visible in prebuilds and
                        optionally in workspaces for this project.
                    </Subheading>
                    <button onClick={() => setShowAddVariableModal(true)}>New Variable</button>
                </div>
            ) : (
                <ItemsList>
                    <Item header={true} className="grid grid-cols-3 items-center">
                        <ItemField>Name</ItemField>
                        <ItemField>Visibility in Workspaces</ItemField>
                        <ItemField></ItemField>
                    </Item>
                    {envVars.map((variable) => {
                        return (
                            <Item key={variable.id} className="grid grid-cols-3 items-center">
                                <ItemField className="truncate">{variable.name}</ItemField>
                                <ItemField>{variable.censored ? "Hidden" : "Visible"}</ItemField>
                                <ItemField className="flex justify-end">
                                    <ItemFieldContextMenu
                                        menuEntries={[
                                            {
                                                title: "Delete",
                                                customFontStyle:
                                                    "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                                onClick: () => deleteEnvVar(variable.id),
                                            },
                                        ]}
                                    />
                                </ItemField>
                            </Item>
                        );
                    })}
                </ItemsList>
            )}
        </section>
    );
}

function AddVariableModal(props: { configuration: Project; onClose: () => void }) {
    const [name, setName] = useState<string>("");
    const [value, setValue] = useState<string>("");
    const [censored, setCensored] = useState<boolean>(true);
    const setProjectEnvVar = useSetProjectEnvVar();

    const addVariable = useCallback(async () => {
        await setProjectEnvVar.mutateAsync(
            {
                projectId: props.configuration.id,
                name,
                value,
                censored,
            },
            { onSuccess: props.onClose },
        );
    }, [censored, name, props.onClose, props.configuration, setProjectEnvVar, value]);

    return (
        <Modal visible onClose={props.onClose} onSubmit={addVariable}>
            <ModalHeader>New Variable</ModalHeader>
            <ModalBody>
                <Alert type="warning">
                    <strong>Project environment variables can be exposed.</strong>
                    <br />
                    Even if <strong>Hide Variable in Workspaces</strong> is enabled, anyone with read access to your
                    repository can access secret values if they are printed in the terminal, logged, or persisted to the
                    file system.
                </Alert>
                <div className="mt-8">
                    <h4>Name</h4>
                    <input
                        autoFocus
                        className="w-full"
                        type="text"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <h4>Value</h4>
                    <input
                        className="w-full"
                        type="text"
                        name="value"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </div>
                <CheckboxInputField
                    label="Hide Variable in Workspaces"
                    hint="Unset this environment variable so that it's not accessible from the terminal in workspaces."
                    checked={censored}
                    onChange={() => setCensored(!censored)}
                />
                {!censored && (
                    <div className="mt-4">
                        <InfoBox>
                            This variable will be visible to anyone who starts a Gitpod workspace for your repository.
                        </InfoBox>
                    </div>
                )}
            </ModalBody>
            <ModalFooter
                alert={
                    setProjectEnvVar.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(setProjectEnvVar.error).replace(/Error: Request \w+ failed with message: /, "")}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <Button type="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button htmlType="submit" loading={setProjectEnvVar.isLoading}>
                    Add Variable
                </Button>
            </ModalFooter>
        </Modal>
    );
}
